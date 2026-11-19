import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type {
  ClozePublicQuestion,
  ListeningPublicQuestion,
  NumericPublicQuestion,
  QuestionType,
  ReadingPublicQuestion,
  SingleChoicePublicQuestion,
  TranslationPublicQuestion,
  WritingPublicQuestion,
} from '../../api/generated/types.gen';
import { QuestionAudio } from '../../components/QuestionAudio';
import { assertNever, type MediaQuestion } from './index';
import {
  isExtendedType,
  QUESTION_TYPE_MODULES,
  QUESTION_TYPE_REGISTRY,
} from './registry';

const ALL_TYPES: QuestionType[] = [
  'single_choice',
  'multiple_choice',
  'true_false',
  'numeric',
  'cloze',
  'listening',
  'reading_comprehension',
  'writing',
  'translation',
];

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PKG_ROOT = path.join(SRC_ROOT, 'features/question-types');

function collectTsFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectTsFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

function resolveImportTargets(file: string): string[] {
  const source = fs.readFileSync(file, 'utf8');
  const targets: string[] = [];
  const pattern = /(?:import|export)\s+(?:type\s+)?(?:[^'"`]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(pattern)) {
    const spec = match[1];
    if (!spec || !spec.startsWith('.')) continue;
    const base = path.resolve(path.dirname(file), spec);
    const candidates = [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      path.join(base, 'index.ts'),
      path.join(base, 'index.tsx'),
    ];
    const resolved = candidates.find(p => fs.existsSync(p) && fs.statSync(p).isFile());
    targets.push(path.relative(SRC_ROOT, resolved ?? base).replaceAll('\\', '/'));
  }
  return targets;
}

function typeModuleGroup(relFromSrc: string): string | null {
  const prefix = 'features/question-types/types/';
  if (!relFromSrc.startsWith(prefix)) return null;
  const rest = relFromSrc.slice(prefix.length);
  return rest.split('/')[0] ?? null;
}

const basePublic = {
  question_id: 1,
  title: 'Sample',
  image_url: '',
  image_type: 0,
  difficulty: 1,
  tags: '',
  licence_id: 1,
  subject_id: 1,
  chapter_id: 1,
  chapter_name: 'Ch1',
  sub_chapter_id: 0,
  sub_chapter_name: '',
  course_id: 1,
  course_name: 'Course',
  sort: 1,
  province_id: 0,
  city_id: 0,
};

describe('QUESTION_TYPE_REGISTRY', () => {
  it('defines non-empty specs and modules for all 9 semantic types', () => {
    expect(Object.keys(QUESTION_TYPE_REGISTRY).sort()).toEqual([...ALL_TYPES].sort());
    expect(Object.keys(QUESTION_TYPE_MODULES).sort()).toEqual([...ALL_TYPES].sort());
    for (const type of ALL_TYPES) {
      const spec = QUESTION_TYPE_REGISTRY[type];
      const mod = QUESTION_TYPE_MODULES[type];
      expect(mod.spec).toEqual(spec);
      expect(spec.type).toBe(type);
      expect(spec.label.length).toBeGreaterThan(0);
      expect(spec.examPrompt.length).toBeGreaterThan(0);
      expect(spec.answerHeading.length).toBeGreaterThan(0);
    }
    expect(QUESTION_TYPE_REGISTRY.multiple_choice.isMultiple).toBe(true);
    expect(QUESTION_TYPE_REGISTRY.writing.isWritten).toBe(true);
    expect(QUESTION_TYPE_REGISTRY.writing.hideAnswerHeading).toBe(true);
    expect(QUESTION_TYPE_REGISTRY.translation.isWritten).toBe(true);
    expect(QUESTION_TYPE_REGISTRY.translation.hideAnswerHeading).toBe(false);
  });

  it('keeps every file in features/question-types within 300 lines', () => {
    const files = collectTsFiles(PKG_ROOT).filter(f => !f.endsWith('.test.ts'));
    expect(files.length).toBeGreaterThanOrEqual(20);
    for (const file of files) {
      const lines = fs.readFileSync(file, 'utf8').split('\n').length;
      expect(lines, path.relative(PKG_ROOT, file)).toBeLessThanOrEqual(300);
    }
  });

  it('enforces the 5-layer acyclic dependency rules', () => {
    // L0: api/ and components/ must have zero imports from features/question-types.
    for (const dir of ['api', 'components']) {
      for (const file of collectTsFiles(path.join(SRC_ROOT, dir))) {
        const bad = resolveImportTargets(file).filter(t =>
          t.startsWith('features/question-types'),
        );
        expect(bad, `L0 ${path.relative(SRC_ROOT, file)}`).toEqual([]);
      }
    }

    // L1: shared/ must only import L0 or shared/ (never types/, registry, facade/, index).
    for (const file of collectTsFiles(path.join(PKG_ROOT, 'shared'))) {
      const bad = resolveImportTargets(file).filter(
        t =>
          t.startsWith('features/question-types/') &&
          !t.startsWith('features/question-types/shared/'),
      );
      expect(bad, `L1 ${path.relative(SRC_ROOT, file)}`).toEqual([]);
    }

    // L2: types/* must have zero sibling cross-imports and zero upward imports.
    for (const file of collectTsFiles(path.join(PKG_ROOT, 'types'))) {
      const rel = path.relative(SRC_ROOT, file).replaceAll('\\', '/');
      const owner = typeModuleGroup(rel);
      const bad = resolveImportTargets(file).filter(t => {
        if (!t.startsWith('features/question-types/')) return false;
        if (t.startsWith('features/question-types/shared/')) return false;
        return typeModuleGroup(t) !== owner;
      });
      expect(bad, `L2 ${rel}`).toEqual([]);
    }

    // L3: registry.ts must not import facade/ or index.
    const registryTargets = resolveImportTargets(path.join(PKG_ROOT, 'registry.ts'));
    expect(
      registryTargets.filter(
        t =>
          t === 'features/question-types/index.ts' ||
          t.startsWith('features/question-types/facade/'),
      ),
    ).toEqual([]);

    // L4: facade/ must not import types/* directly or index.ts.
    for (const file of collectTsFiles(path.join(PKG_ROOT, 'facade'))) {
      const bad = resolveImportTargets(file).filter(
        t =>
          t === 'features/question-types/index.ts' ||
          t.startsWith('features/question-types/types/'),
      );
      expect(bad, `L4 ${path.relative(SRC_ROOT, file)}`).toEqual([]);
    }

    // L5: study mode consumers must only import question-types via index.ts barrel.
    for (const mode of ['practice', 'memorization', 'exam', 'palace', 'analysis']) {
      for (const file of collectTsFiles(path.join(SRC_ROOT, 'features', mode))) {
        const bad = resolveImportTargets(file).filter(
          t =>
            t.startsWith('features/question-types/') &&
            t !== 'features/question-types/index.ts',
        );
        expect(bad, `L5 ${path.relative(SRC_ROOT, file)}`).toEqual([]);
      }
    }
  });

  it('classifies extended vs v1 question types', () => {
    expect(isExtendedType('single_choice')).toBe(false);
    expect(isExtendedType('multiple_choice')).toBe(false);
    expect(isExtendedType('true_false')).toBe(false);
    expect(isExtendedType('numeric')).toBe(false);
    expect(isExtendedType('cloze')).toBe(true);
    expect(isExtendedType('listening')).toBe(true);
    expect(isExtendedType('reading_comprehension')).toBe(true);
    expect(isExtendedType('writing')).toBe(true);
    expect(isExtendedType('translation')).toBe(true);
  });

  it('throws on unexpected runtime values in assertNever', () => {
    expect(() => assertNever('unknown' as never)).toThrow(/Unhandled question type/);
  });

  it('enforces compile-time cross-type isolation on QuestionAudio and union fields', () => {
    const singleChoice: SingleChoicePublicQuestion = {
      ...basePublic,
      question_type: 'single_choice',
      items: [],
    };
    const numeric: NumericPublicQuestion = {
      ...basePublic,
      question_type: 'numeric',
    };
    const listening: ListeningPublicQuestion = {
      ...basePublic,
      question_type: 'listening',
      content: { sub_questions: [] },
    };
    const cloze: ClozePublicQuestion = {
      ...basePublic,
      question_type: 'cloze',
      content: { passage: 'Every worker {{1}} sign.', blanks: [] },
    };
    const reading: ReadingPublicQuestion = {
      ...basePublic,
      question_type: 'reading_comprehension',
      content: { passage: 'Notice', sub_questions: [] },
    };
    const writing: WritingPublicQuestion = {
      ...basePublic,
      question_type: 'writing',
      content: { subtype: 'sentence_making', requirements: [] },
    };
    const translation: TranslationPublicQuestion = {
      ...basePublic,
      question_type: 'translation',
      content: { direction: 'en_to_zh', source_text: 'Hello' },
    };

    // Positive: media-capable variants satisfy MediaQuestion and QuestionAudio props.
    const mediaQuestions: MediaQuestion[] = [singleChoice, numeric, listening];
    expect(mediaQuestions).toHaveLength(3);
    const validAudioProps: Parameters<typeof QuestionAudio>[0] = { question: listening };
    expect(validAudioProps.question.question_type).toBe('listening');

    // Negative: non-media variants cannot be passed to QuestionAudio.
    // @ts-expect-error cloze is not a MediaQuestion
    const badClozeAudio: Parameters<typeof QuestionAudio>[0] = { question: cloze };
    // @ts-expect-error reading_comprehension is not a MediaQuestion
    const badReadingAudio: Parameters<typeof QuestionAudio>[0] = { question: reading };
    // @ts-expect-error writing is not a MediaQuestion
    const badWritingAudio: Parameters<typeof QuestionAudio>[0] = { question: writing };
    // @ts-expect-error translation is not a MediaQuestion
    const badTranslationAudio: Parameters<typeof QuestionAudio>[0] = { question: translation };

    // Negative: variants cannot access foreign type-specific fields.
    // @ts-expect-error cloze has no transcript_lines
    const badClozeTranscript = cloze.transcript_lines;
    // @ts-expect-error reading_comprehension has no audio_url
    const badReadingUrl = reading.audio_url;
    // @ts-expect-error writing content has no blanks
    const badWritingBlanks = writing.content.blanks;
    // @ts-expect-error numeric has no items
    const badNumericItems = numeric.items;

    expect([
      badClozeAudio,
      badReadingAudio,
      badWritingAudio,
      badTranslationAudio,
      badClozeTranscript,
      badReadingUrl,
      badWritingBlanks,
      badNumericItems,
    ]).toBeDefined();
  });
});

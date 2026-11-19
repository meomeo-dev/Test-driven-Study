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
import {
  assertNever,
  isExtendedType,
  QUESTION_TYPE_REGISTRY,
  type MediaQuestion,
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
  it('defines non-empty specs for all 9 semantic types', () => {
    expect(Object.keys(QUESTION_TYPE_REGISTRY).sort()).toEqual([...ALL_TYPES].sort());
    for (const type of ALL_TYPES) {
      const spec = QUESTION_TYPE_REGISTRY[type];
      expect(spec.label.length).toBeGreaterThan(0);
      expect(spec.examPrompt.length).toBeGreaterThan(0);
      expect(spec.answerHeading.length).toBeGreaterThan(0);
    }
    expect(QUESTION_TYPE_REGISTRY.multiple_choice.isMultiple).toBe(true);
    expect(QUESTION_TYPE_REGISTRY.writing.isWritten).toBe(true);
    expect(QUESTION_TYPE_REGISTRY.translation.isWritten).toBe(true);
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

import { describe, expect, it } from 'vitest';
import type { Question, StudyTranslationSurface } from '../../../api/generated/types.gen';
import {
  canDisplayStudyTranslation,
  getStudyTranslation,
  optionTranslationsBySign,
  visibleStudyTranslation,
} from './study-translation';

const ALL_SURFACES: StudyTranslationSurface[] = [
  'memorize',
  'practice_review',
  'exam_review',
  'typing',
  'palace',
];

const baseQuestion = {
  question_id: 1,
  title: 'Hello',
  image_url: '',
  image_type: 0,
  answer: '1',
  analysis: '',
  skill: '',
  difficulty: 1,
  tags: '',
  licence_id: 0,
  subject_id: 1,
  chapter_id: 1,
  chapter_name: 'Unit 1',
  sub_chapter_id: 0,
  sub_chapter_name: '',
  course_id: 1,
  course_name: 'Course',
  sort: 1,
  province_id: 0,
  city_id: 0,
};

describe('study-translation visibility helpers', () => {
  it('defaults omitted display_in to all five surfaces', () => {
    const tr = { stem: '你好' };
    for (const surface of ALL_SURFACES) {
      expect(canDisplayStudyTranslation(tr, surface)).toBe(true);
    }
    expect(canDisplayStudyTranslation(undefined, 'memorize')).toBe(false);
  });

  it('restricts display strictly to surfaces listed in display_in', () => {
    const tr = { display_in: ['memorize', 'typing'] as StudyTranslationSurface[], stem: '你好' };
    expect(canDisplayStudyTranslation(tr, 'memorize')).toBe(true);
    expect(canDisplayStudyTranslation(tr, 'typing')).toBe(true);
    expect(canDisplayStudyTranslation(tr, 'practice_review')).toBe(false);
    expect(canDisplayStudyTranslation(tr, 'exam_review')).toBe(false);
    expect(canDisplayStudyTranslation(tr, 'palace')).toBe(false);
  });

  it('resolves top-level and review study_translation and maps option IDs to signs', () => {
    const question: Question = {
      ...baseQuestion,
      question_type: 'single_choice',
      items: [
        { id: 'b', sign: 1, item_title: 'Good night.' },
        { id: 'a', sign: 2, item_title: 'Good morning.' },
      ],
      study_translation: {
        display_in: ['memorize', 'practice_review'],
        stem: '请选择问候语。',
        options: { a: '早上好。', b: '晚安。' },
      },
    };
    expect(getStudyTranslation(question)?.stem).toBe('请选择问候语。');
    expect(visibleStudyTranslation(question, 'memorize', true)?.stem).toBe('请选择问候语。');
    expect(visibleStudyTranslation(question, 'memorize', false)).toBeUndefined();
    expect(visibleStudyTranslation(question, 'palace', true)).toBeUndefined();
    // Preserves ID matching even when option signs are shuffled.
    expect(optionTranslationsBySign(question.items, getStudyTranslation(question))).toEqual({
      1: '晚安。',
      2: '早上好。',
    });
  });
});

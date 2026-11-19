import { describe, expect, it } from 'vitest';
import type { Attempt, PublicQuestion, Question } from '../../api/generated/types.gen';
import {
  formatAttemptSummary,
  formatExamNavValue,
  hasCourseReviewExplanation,
  hasDraftAnswer,
  hasRichContent,
  questionHasReviewExplanation,
  questionHasWritingCriteria,
  questionType,
  readyResponse,
  shouldShowExplanation,
} from './index';

const baseFields = {
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

const baseAttempt: Omit<Attempt, 'question_type'> = {
  id: 1,
  presentation_id: 'p1',
  question_id: 1,
  subject_id: 1,
  chapter_id: 1,
  chapter_name: 'Ch1',
  question_title: 'Sample',
  question_revision: 'rev',
  selected: [],
  correct_answer: [],
  correct: false,
  first_attempt: true,
  prior_exposure: false,
  opened_at_ms: 1000,
  answered_at_ms: 2000,
};

describe('question-types helpers', () => {
  it('detects non-empty plain and segmented rich content', () => {
    expect(hasRichContent(undefined)).toBe(false);
    expect(hasRichContent('   ')).toBe(false);
    expect(hasRichContent([])).toBe(false);
    expect(hasRichContent('解释')).toBe(true);
    expect(hasRichContent([{ type: 'text', text: 'hello' }])).toBe(true);
  });

  it('detects explanations nested inside blanks or sub_questions', () => {
    expect(hasCourseReviewExplanation(undefined)).toBe(false);
    expect(
      hasCourseReviewExplanation({
        id: 'c1',
        type: 'cloze',
        stem: '',
        passage: '',
        blanks: [{ index: 1, options: [], grading: {}, explanation: '语法说明' }],
      }),
    ).toBe(true);
    expect(
      hasCourseReviewExplanation({
        id: 'l1',
        type: 'listening',
        stem: '',
        sub_questions: [
          {
            id: 'q1',
            type: 'single_choice',
            stem: '',
            options: [],
            grading: {},
            analysis: '听力依据',
          },
        ],
      }),
    ).toBe(true);
    expect(
      hasCourseReviewExplanation({
        id: 'l2',
        type: 'listening',
        stem: '',
        sub_questions: [
          { id: 'q1', type: 'single_choice', stem: '', options: [], grading: {} },
        ],
      }),
    ).toBe(false);
    expect(
      hasCourseReviewExplanation({
        id: 'w1',
        type: 'writing',
        stem: '',
        subtype: 'sentence_making',
        requirements: [],
      }),
    ).toBe(false);
  });

  it('formats labels for all 9 semantic question types', () => {
    expect(questionType('single_choice')).toBe('单选题');
    expect(questionType('multiple_choice')).toBe('多选题');
    expect(questionType('true_false')).toBe('判断题');
    expect(questionType('numeric')).toBe('数值题');
    expect(questionType('cloze')).toBe('完形填空');
    expect(questionType('listening')).toBe('听力题');
    expect(questionType('reading_comprehension')).toBe('阅读理解');
    expect(questionType('writing')).toBe('写作题');
    expect(questionType('translation')).toBe('翻译题');
  });

  it('checks draft readiness and normalizes extended responses', () => {
    const choiceQ: PublicQuestion = {
      ...baseFields,
      question_type: 'single_choice',
      items: [{ sign: 1, item_title: 'A' }],
    };
    const numericQ: PublicQuestion = { ...baseFields, question_type: 'numeric' };
    const writingQ: PublicQuestion = {
      ...baseFields,
      question_type: 'writing',
      content: { subtype: 'sentence_making', requirements: [] },
    };
    expect(
      hasDraftAnswer(choiceQ, { selected: [], numeric: '', canSubmitExtended: false }),
    ).toBe(false);
    expect(
      hasDraftAnswer(choiceQ, { selected: [1], numeric: '', canSubmitExtended: false }),
    ).toBe(true);
    expect(
      hasDraftAnswer(numericQ, { selected: [], numeric: '  ', canSubmitExtended: false }),
    ).toBe(false);
    expect(
      hasDraftAnswer(numericQ, { selected: [], numeric: '42', canSubmitExtended: false }),
    ).toBe(true);
    expect(
      hasDraftAnswer(writingQ, { selected: [], numeric: '', canSubmitExtended: true }),
    ).toBe(true);

    expect(readyResponse({ value: false })).toEqual({ value: false });
    expect(readyResponse({ blanks: { '1': ['a'] } })).toEqual({ blanks: { '1': ['a'] } });
    expect(readyResponse({ sub_answers: { a: '  ', b: [], c: ' 8 ' } })).toEqual({
      sub_answers: { c: '8' },
    });
    expect(readyResponse({ text: '  hello  ' })).toEqual({ text: 'hello' });
    expect(readyResponse({ translation: '  译文  ' })).toEqual({ translation: '译文' });
    expect(readyResponse({ text: '   ' })).toBeUndefined();
  });

  it('evaluates practice explanation visibility and review/criteria hooks', () => {
    const emptyCloze: Question = {
      ...baseFields,
      question_type: 'cloze',
      answer: '',
      analysis: '',
      skill: '',
      content: { passage: '', blanks: [] },
      question_review: { id: 'c1', type: 'cloze', stem: '', passage: '', blanks: [] },
    };
    expect(shouldShowExplanation(emptyCloze)).toBe(false);
    expect(questionHasReviewExplanation(emptyCloze)).toBe(false);

    const explainedCloze: Question = {
      ...emptyCloze,
      question_review: {
        id: 'c1',
        type: 'cloze',
        stem: '',
        passage: '',
        blanks: [{ index: 1, options: [], grading: {}, explanation: '解释' }],
      },
    };
    expect(shouldShowExplanation(explainedCloze)).toBe(true);
    expect(questionHasReviewExplanation(explainedCloze)).toBe(true);

    const translationWithReview: Question = {
      ...baseFields,
      question_type: 'translation',
      answer: '',
      analysis: '',
      skill: '',
      content: { direction: 'en_to_zh', source_text: 'Hi' },
      question_review: {
        id: 't1',
        type: 'translation',
        stem: '',
        direction: 'en_to_zh',
        source_text: 'Hi',
      },
    };
    expect(shouldShowExplanation(translationWithReview)).toBe(false);

    const writingWithCriteria: Question = {
      ...baseFields,
      question_type: 'writing',
      answer: '',
      analysis: '',
      skill: '',
      content: { subtype: 'sentence_making', requirements: [] },
      question_review: {
        id: 'w1',
        type: 'writing',
        stem: '',
        subtype: 'sentence_making',
        requirements: [],
        keywords: ['Friday'],
      },
    };
    expect(questionHasWritingCriteria(writingWithCriteria)).toBe(true);
    expect(shouldShowExplanation(writingWithCriteria)).toBe(true);
  });

  it('formats exam navigation values and attempt summaries across all 9 types', () => {
    const mc: PublicQuestion = {
      ...baseFields,
      question_type: 'multiple_choice',
      items: [
        { sign: 2, item_title: 'First' },
        { sign: 1, item_title: 'Second' },
      ],
    };
    const tf: PublicQuestion = {
      ...baseFields,
      question_type: 'true_false',
      items: [
        { sign: 1, item_title: '对', boolean_value: true },
        { sign: 2, item_title: '错', boolean_value: false },
      ],
    };
    const num: PublicQuestion = { ...baseFields, question_type: 'numeric' };
    const cloze: PublicQuestion = {
      ...baseFields,
      question_type: 'cloze',
      content: { passage: '', blanks: [] },
    };
    expect(formatExamNavValue(mc, [1, 2])).toBe('AB');
    expect(formatExamNavValue(tf, [2])).toBe('×');
    expect(formatExamNavValue(num, [], '3.5')).toBe('3.5');
    expect(formatExamNavValue(cloze, [], undefined, { blanks: { '1': ['a'] } })).toBe(
      '已答',
    );
    expect(formatExamNavValue(cloze, [])).toBe('');

    expect(
      formatAttemptSummary({
        ...baseAttempt,
        question_type: 'writing',
        response: { text: 'Hi', word_count: 3 },
        score: 1,
      }),
    ).toBe('写作作答（3 词） · 得分 100%');
  });
});

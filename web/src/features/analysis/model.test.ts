import { describe, expect, it } from 'vitest';
import type { Attempt } from '../../api/practice';
import { attemptSummary } from './model';

const base: Omit<Attempt, 'question_type'> = {
  id: 1,
  presentation_id: 'p1',
  question_id: 101,
  subject_id: 101,
  chapter_id: 1,
  chapter_name: 'Ch1',
  question_title: 'Title',
  question_revision: 'rev',
  selected: [],
  correct_answer: [],
  correct: false,
  first_attempt: true,
  prior_exposure: false,
  opened_at_ms: 1000,
  answered_at_ms: 2000,
};

describe('attemptSummary', () => {
  it('formats all 9 question types via semantic question_type', () => {
    expect(
      attemptSummary({
        ...base,
        question_type: 'single_choice',
        selected: [2],
        correct_answer: [1],
      }),
    ).toBe('你的选择 2 · 正确选项 1');
    expect(
      attemptSummary({
        ...base,
        question_type: 'multiple_choice',
        selected: [1, 3],
        correct_answer: [1, 2],
      }),
    ).toBe('你的选择 1, 3 · 正确选项 1, 2');
    expect(
      attemptSummary({
        ...base,
        question_type: 'true_false',
        response: { value: false },
        score: 1,
      }),
    ).toBe('你的判断 错误 · 得分 100%');
    expect(
      attemptSummary({
        ...base,
        question_type: 'true_false',
        selected: [2],
        correct_answer: [1],
      }),
    ).toBe('你的选择 2 · 正确选项 1');
    expect(
      attemptSummary({
        ...base,
        question_type: 'numeric',
        numeric: '14',
        correct_numeric: '15',
      }),
    ).toBe('你的答案 14 · 正确答案 15');
    expect(
      attemptSummary({
        ...base,
        question_type: 'cloze',
        response: { blanks: { '1': ['must'] } },
        score: 0.5,
      }),
    ).toBe('完形作答（1 空） · 得分 50%');
    expect(
      attemptSummary({
        ...base,
        question_type: 'listening',
        response: { sub_answers: { a: ['x'], b: true } },
        score: 1,
      }),
    ).toBe('小题作答（2 题） · 得分 100%');
    expect(
      attemptSummary({
        ...base,
        question_type: 'reading_comprehension',
        response: { sub_answers: { q1: '8' } },
        score: 1,
      }),
    ).toBe('小题作答（1 题） · 得分 100%');
    expect(
      attemptSummary({
        ...base,
        question_type: 'writing',
        response: { text: 'Hi', word_count: 7 },
        score: 0.5,
      }),
    ).toBe('写作作答（7 词） · 得分 50%');
    expect(
      attemptSummary({
        ...base,
        question_type: 'translation',
        response: { translation: '译文' },
        score: 1,
      }),
    ).toBe('翻译作答 · 得分 100%');
  });
});

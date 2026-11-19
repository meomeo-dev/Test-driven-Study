import { describe, expect, it } from 'vitest';
import { hasReviewExplanation, hasRichContent, questionType } from './model';

describe('question-types helpers', () => {
  it('detects non-empty plain and segmented rich content', () => {
    expect(hasRichContent(undefined)).toBe(false);
    expect(hasRichContent('   ')).toBe(false);
    expect(hasRichContent([])).toBe(false);
    expect(hasRichContent('解释')).toBe(true);
    expect(hasRichContent([{ type: 'text', text: 'hello' }])).toBe(true);
  });

  it('detects explanations nested inside blanks or sub_questions', () => {
    expect(hasReviewExplanation(undefined)).toBe(false);
    expect(
      hasReviewExplanation({
        id: 'c1',
        type: 'cloze',
        stem: '',
        passage: '',
        blanks: [{ index: 1, options: [], grading: {}, explanation: '语法说明' }],
      }),
    ).toBe(true);
    expect(
      hasReviewExplanation({
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
      hasReviewExplanation({
        id: 'l2',
        type: 'listening',
        stem: '',
        sub_questions: [
          { id: 'q1', type: 'single_choice', stem: '', options: [], grading: {} },
        ],
      }),
    ).toBe(false);
    expect(
      hasReviewExplanation({
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
});

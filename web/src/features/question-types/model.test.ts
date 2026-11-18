import { describe, expect, it } from 'vitest';
import type { CourseItemReview } from '../../api/generated/types.gen';
import { hasReviewExplanation, hasRichContent } from './model';

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
    expect(hasReviewExplanation({
      id: 'c1', type: 'cloze', stem: '',
      blanks: [{ index: 1, options: [], grading: {}, explanation: '语法说明' }],
    } as CourseItemReview)).toBe(true);
    expect(hasReviewExplanation({
      id: 'l1', type: 'listening', stem: '',
      sub_questions: [{ id: 'q1', type: 'single_choice', stem: '', analysis: '听力依据' }],
    } as CourseItemReview)).toBe(true);
    expect(hasReviewExplanation({
      id: 'l2', type: 'listening', stem: '',
      sub_questions: [{ id: 'q1', type: 'single_choice', stem: '' }],
    } as CourseItemReview)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { evidenceText, practiceLink, prerequisiteText } from './model';

describe('learning model', () => {
  it('describes alternative prerequisite groups', () => {
    const titles = new Map([['a', '加法'], ['b', '减法'], ['c', '计数']]);
    expect(prerequisiteText([], titles)).toBe('无先修要求');
    expect(prerequisiteText([['a', 'b'], ['c']], titles)).toBe('加法 + 减法；或 计数');
  });

  it('links practice to the concept unit with a concept filter', () => {
    expect(practiceLink('concept-graph', { id: 'word-problems', subject_id: 102 }))
      .toBe('/practice?subject=102&course=concept-graph&concept=word-problems');
  });

  it('explains evidence and self-check concepts', () => {
    const base = { item_count: 3, attempted: 2, correct: 1, required_correct: 3 };
    expect(evidenceText(base as never)).toContain('已作答 2/3 题');
    expect(evidenceText({ ...base, item_count: 0 } as never)).toContain('标记为已会');
  });
});

import { describe, expect, it } from 'vitest';
import type { Summary } from '../../api/client';
import { activeQuestion, answerSigns, nearbyQuestion, readFilters } from './model';
const rows = [4, 6, 16].map(question_id => ({ question_id })) as Summary[];

describe('memorization navigation', () => {
  it('resumes a saved question only if it belongs to the current result', () => {
    expect(activeQuestion(rows, null, 6)).toBe(6);
    expect(activeQuestion(rows, null, 999)).toBe(4);
    expect(activeQuestion([], null, 6)).toBe(0);
  });
  it('honors explicit navigation and never leaks a filtered-out question', () => {
    expect(activeQuestion(rows, '16', 6)).toBe(16);
    expect(activeQuestion(rows, '999', 6)).toBe(4);
    expect(nearbyQuestion(rows, 4, -1)).toBeUndefined();
    expect(nearbyQuestion(rows, 16, 1)).toBeUndefined();
    expect(nearbyQuestion(rows, 6, 1)).toBe(16);
  });
  it('treats real chapter zero separately from all chapters', () => {
    expect(readFilters(new URLSearchParams('subject=4&chapter=0')).chapter).toBe('0');
    expect(readFilters(new URLSearchParams()).chapter).toBe('');
  });
  it('rejects invalid URL filters and bounds search input', () => {
    const filters = readFilters(new URLSearchParams({ subject: '8', chapter: '-4', state: 'bad', q: 'x'.repeat(201) }));
    expect(filters).toEqual({ subject: 0, chapter: '', state: 'all', search: 'x'.repeat(200) });
  });
  it('preserves multiple-answer membership without substring matching', () => {
    expect([...answerSigns('1,2,3')]).toEqual([1, 2, 3]);
    expect(answerSigns('1,2,3').has(4)).toBe(false);
  });
});

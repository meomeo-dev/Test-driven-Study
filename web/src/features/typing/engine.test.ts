import { describe, expect, it } from 'vitest';
import {
  buildRecallDisplay,
  charsMatch,
  evaluateTyping,
  nextHintPrefix,
  type ImeState,
} from './engine';

const IDLE_IME: ImeState = { isComposing: false, compositionStart: 0, compositionText: '' };

describe('typing engine character matching', () => {
  it('matches English case-insensitively and normalizes typographic punctuation', () => {
    expect(charsMatch('G', 'g')).toBe(true);
    expect(charsMatch('\u2019', "'")).toBe(true);
    expect(charsMatch('\u2013', '-')).toBe(true);
    expect(charsMatch('，', ',')).toBe(true);
    expect(charsMatch('。', '.')).toBe(true);
    expect(charsMatch('？', '?')).toBe(true);
    expect(charsMatch('（', '(')).toBe(true);
    expect(charsMatch('你', '我')).toBe(false);
  });
});

describe('typing engine Chinese IME safety', () => {
  it('defers grading while IME composition is active at the start of a Chinese sentence', () => {
    const result = evaluateTyping('你好，世界。', 'nihao', {
      isComposing: true,
      compositionStart: 0,
      compositionText: 'nihao',
    });
    expect(result.hasError).toBe(false);
    expect(result.wrongCount).toBe(0);
    expect(result.imePending).toBe(true);
    expect(result.isComplete).toBe(false);
    expect(result.cells[0]?.state).toBe('pending');
  });

  it('keeps committed prefix green while deferring mid-sentence IME Pinyin', () => {
    const result = evaluateTyping('你好，世界。', "你好，shi'jie", {
      isComposing: true,
      compositionStart: 3,
      compositionText: "shi'jie",
    });
    expect(result.hasError).toBe(false);
    expect(result.wrongCount).toBe(0);
    expect(result.matchedCount).toBe(3);
    expect(result.imePending).toBe(true);
    expect(result.cells.slice(0, 3).every(cell => cell.state === 'correct')).toBe(true);
    expect(result.cells[3]?.state).toBe('pending');
  });

  it('completes once Chinese characters are committed via compositionend', () => {
    const result = evaluateTyping('你好，世界。', '你好，世界。', IDLE_IME);
    expect(result.isComplete).toBe(true);
    expect(result.hasError).toBe(false);
    expect(result.matchedCount).toBe(6);
  });

  it('guards trailing ASCII Pinyin against CJK targets even without compositionstart', () => {
    const pending = evaluateTyping('你好，世界。', '你好，shijie', IDLE_IME);
    expect(pending.hasError).toBe(false);
    expect(pending.wrongCount).toBe(0);
    expect(pending.imePending).toBe(true);
    expect(pending.matchedCount).toBe(3);
    expect(pending.cells[3]?.state).toBe('pending');

    const wrongHanzi = evaluateTyping('你好，世界。', '你好，是', IDLE_IME);
    expect(wrongHanzi.hasError).toBe(true);
    expect(wrongHanzi.wrongCount).toBe(1);
    expect(wrongHanzi.imePending).toBe(false);
    expect(wrongHanzi.cells[3]?.state).toBe('wrong');
  });

  it('protects CJK slots while grading English immediately in mixed sentences', () => {
    const sentence = '班长对你说：How are you?';
    const cjkPending = evaluateTyping(sentence, 'ban', IDLE_IME);
    expect(cjkPending.hasError).toBe(false);
    expect(cjkPending.imePending).toBe(true);

    const englishWrong = evaluateTyping(sentence, '班长对你说：Hx', IDLE_IME);
    expect(englishWrong.hasError).toBe(true);
    expect(englishWrong.wrongCount).toBe(1);
    expect(englishWrong.cells[7]?.state).toBe('wrong');

    const done = evaluateTyping(sentence, '班长对你说:how are you?', IDLE_IME);
    expect(done.isComplete).toBe(true);
  });

  it('reports overflow characters as extraWrong', () => {
    const result = evaluateTyping('Hello.', 'Hello.!!', IDLE_IME);
    expect(result.isComplete).toBe(false);
    expect(result.hasError).toBe(true);
    expect(result.extraWrong).toBe('!!');
    expect(result.wrongCount).toBe(2);
  });
});

describe('typing hint and recall helpers', () => {
  it('reveals one English word or one Chinese character at a time', () => {
    expect(nextHintPrefix('Good morning.', '')).toBe('Good');
    expect(nextHintPrefix('Good morning.', 'Good')).toBe('Good morning');
    expect(nextHintPrefix('Good morning.', 'Good morning')).toBe('Good morning.');
    expect(nextHintPrefix('你好世界', '')).toBe('你');
    expect(nextHintPrefix('你好世界', '你')).toBe('你好');
  });

  it('masks recall display with first-letter clues for English and full-width blanks for CJK', () => {
    expect(buildRecallDisplay('Good morning.', 0).join('')).toBe('G___ m______.');
    expect(buildRecallDisplay('Good morning.', 5).join('')).toBe('Good m______.');
    expect(buildRecallDisplay('你好，世界。', 2).join('')).toBe('你好，＿＿。');
  });
});

import { describe, expect, it } from 'vitest';
import type { ExamItem } from '../../api/exams';
import {
  answerSymbols, hasDetailedJudgmentOptions, judgmentOptionAt, optionSymbol,
} from './terminalLabels';

const question: ExamItem['detail']['question'] = {
  question_id: 1, subject_id: 1, question_type: 1, title: 'Example',
  items: [
    { sign: 3, item_title: 'First displayed' }, { sign: 1, item_title: 'Second displayed' },
    { sign: 4, item_title: 'Third displayed' }, { sign: 2, item_title: 'Fourth displayed' },
  ], image_url: '', image_type: 0, chapter_id: 0, chapter_name: '',
  difficulty: 1, sub_chapter_id: 0, sub_chapter_name: '', tags: '',
  licence_id: 2, province_id: 0, city_id: 0, course_id: 0, course_name: '', sort: 0,
};

describe('terminal answer labels', () => {
  it('maps stable answer signs to the shuffled visible letters', () => {
    expect(optionSymbol(question, 3)).toBe('A');
    expect(optionSymbol(question, 1)).toBe('B');
    expect(answerSymbols(question, [1, 3])).toBe('A、B');
    expect(answerSymbols(question, [2, 1, 4, 3])).toBe('A、B、C、D');
  });
  it('shows a false selection as × without treating it as grading', () => {
    const judgment = { ...question, question_type: 3, items: [
      { sign: 1, item_title: '对' }, { sign: 2, item_title: '错' },
    ] };
    expect(optionSymbol(judgment, 1)).toBe('√');
    expect(answerSymbols(judgment, [2])).toBe('×');
    expect(hasDetailedJudgmentOptions(judgment)).toBe(false);
    expect(judgmentOptionAt(judgment, 0)?.sign).toBe(1);
  });
  it('detects custom judgment options and maps 1/2 shortcuts by boolean_value', () => {
    const custom = { ...question, question_type: 3, items: [
      { sign: 1, item_title: '违反规定', boolean_value: false },
      { sign: 2, item_title: '符合规定', boolean_value: true, tts: { voice: 'stella' as const } },
    ] };
    expect(hasDetailedJudgmentOptions(custom)).toBe(true);
    expect(optionSymbol(custom, 1)).toBe('×');
    expect(optionSymbol(custom, 2)).toBe('√');
    expect(judgmentOptionAt(custom, 0)?.sign).toBe(2);
    expect(judgmentOptionAt(custom, 1)?.sign).toBe(1);
  });
});

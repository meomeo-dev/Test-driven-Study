import { questionType as label } from '../question-types/model';
import type { ExamItem, ExamSession } from '../../api/exams';

type Question = ExamItem['detail']['question'];
export const questionType = (q: Question) => label(q.question_type);

export function optionSymbol(q: Question, sign: number) {
  const index = q.items.findIndex(option => option.sign === sign);
  if (q.question_type === 3) {
    const option = q.items[index];
    const value = option?.boolean_value ?? (option?.item_title === '正确' || option?.item_title === '对');
    return value ? '√' : '×';
  }
  return index < 0 ? '' : String.fromCharCode(65 + index);
}

export const answerSymbols = (q: Question, selected: number[]) =>
  q.items.filter(option => selected.includes(option.sign))
    .map(option => optionSymbol(q, option.sign)).join('、');

const defaultJudgmentLabels = new Set(['正确', '错误', '对', '错']);

export function hasDetailedJudgmentOptions(q: Question) {
  return q.question_type === 3 && q.items.some(option =>
    Boolean(option.tts) || Boolean(option.pinyin?.length) ||
    !defaultJudgmentLabels.has(option.item_title));
}

export function judgmentOptionAt(q: Question, position: number) {
  if (q.question_type === 3 && (position === 0 || position === 1)) {
    const matched = q.items.find(option => option.boolean_value === (position === 0));
    if (matched) return matched;
  }
  return q.items[position];
}

export const examCounts = (session: ExamSession) => ({
  correct: session.items.filter(item => item.correct === true).length,
  incorrect: session.items.filter(item => item.answered && item.correct === false).length,
  unanswered: session.items.filter(item => !item.answered).length,
});

export const clockText = (seconds: number) =>
  `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

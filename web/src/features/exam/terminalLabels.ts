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

export const examCounts = (session: ExamSession) => ({
  correct: session.items.filter(item => item.correct === true).length,
  incorrect: session.items.filter(item => item.answered && item.correct === false).length,
  unanswered: session.items.filter(item => !item.answered).length,
});

export const clockText = (seconds: number) =>
  `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

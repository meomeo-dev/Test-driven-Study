import type { ExamItem, ExamSession } from '../../api/exams';
import { questionType as label } from '../question-types/model';
import { assertNever } from '../question-types/registry';

type Question = ExamItem['detail']['question'];
export const questionType = (q: Question) => label(q.question_type);

export function optionSymbol(q: Question, sign: number): string {
  switch (q.question_type) {
    case 'true_false': {
      const option = q.items.find(item => item.sign === sign);
      const value =
        option?.boolean_value ?? (option?.item_title === '正确' || option?.item_title === '对');
      return value ? '√' : '×';
    }
    case 'single_choice':
    case 'multiple_choice': {
      const index = q.items.findIndex(option => option.sign === sign);
      return index < 0 ? '' : String.fromCharCode(65 + index);
    }
    case 'numeric':
    case 'cloze':
    case 'listening':
    case 'reading_comprehension':
    case 'writing':
    case 'translation':
      return '';
    default:
      return assertNever(q);
  }
}

export function answerSymbols(q: Question, selected: number[]): string {
  switch (q.question_type) {
    case 'single_choice':
    case 'multiple_choice':
    case 'true_false':
      return q.items
        .filter(option => selected.includes(option.sign))
        .map(option => optionSymbol(q, option.sign))
        .join('、');
    case 'numeric':
    case 'cloze':
    case 'listening':
    case 'reading_comprehension':
    case 'writing':
    case 'translation':
      return '';
    default:
      return assertNever(q);
  }
}

const defaultJudgmentLabels = new Set(['正确', '错误', '对', '错']);

export function hasDetailedJudgmentOptions(q: Question): boolean {
  return (
    q.question_type === 'true_false' &&
    q.items.some(
      option =>
        Boolean(option.tts) ||
        Boolean(option.pinyin?.length) ||
        !defaultJudgmentLabels.has(option.item_title),
    )
  );
}

export function judgmentOptionAt(q: Question, position: number) {
  switch (q.question_type) {
    case 'true_false':
      if (position === 0 || position === 1) {
        const matched = q.items.find(option => option.boolean_value === (position === 0));
        if (matched) return matched;
      }
      return q.items[position];
    case 'single_choice':
    case 'multiple_choice':
      return q.items[position];
    case 'numeric':
    case 'cloze':
    case 'listening':
    case 'reading_comprehension':
    case 'writing':
    case 'translation':
      return undefined;
    default:
      return assertNever(q);
  }
}

export const examCounts = (session: ExamSession) => ({
  correct: session.items.filter(item => item.correct === true).length,
  incorrect: session.items.filter(item => item.answered && item.correct === false).length,
  unanswered: session.items.filter(item => !item.answered).length,
});

export const clockText = (seconds: number) =>
  `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60)
    .toString()
    .padStart(2, '0')}`;

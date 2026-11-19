import type { ExamItem, ExamSession } from '../../api/exams';
import {
  answerSymbols as choiceAnswerSymbols,
  assertNever,
  hasDetailedJudgmentOptions as hasDetailedTrueFalseOptions,
  judgmentOptionAt as choiceJudgmentOptionAt,
  optionSymbol as choiceOptionSymbol,
  questionType as label,
} from '../question-types';

type Question = ExamItem['detail']['question'];
export const questionType = (q: Question) => label(q.question_type);

export function optionSymbol(q: Question, sign: number): string {
  switch (q.question_type) {
    case 'single_choice':
    case 'multiple_choice':
    case 'true_false':
      return choiceOptionSymbol(q, sign);
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
      return choiceAnswerSymbols(q, selected);
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

export function hasDetailedJudgmentOptions(q: Question): boolean {
  return q.question_type === 'true_false' && hasDetailedTrueFalseOptions(q);
}

export function judgmentOptionAt(q: Question, position: number) {
  switch (q.question_type) {
    case 'single_choice':
    case 'multiple_choice':
    case 'true_false':
      return choiceJudgmentOptionAt(q, position);
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

import { readSubject } from '../../app/workspace';
import type { Filters, Summary } from '../../api/client';
import type { QuestionNavigationStatus } from '../question-navigation';

export function readFilters(params: URLSearchParams): Filters {
  const subject = readSubject(params);
  const state = params.get('state') ?? 'all';
  const rawChapter = params.get('chapter') ?? '';
  return {
    subject, chapter: /^\d+$/.test(rawChapter) ? rawChapter : '',
    state: ['all', 'unlearned', 'review', 'mastered'].includes(state) ? state : 'all',
    search: (params.get('q') ?? '').slice(0, 200),
  };
}
export function activeQuestion(rows: Summary[], requested: string | null, last: number) {
  const id = Number(requested);
  if (rows.some(row => row.question_id === id)) return id;
  if (!requested && rows.some(row => row.question_id === last)) return last;
  return rows[0]?.question_id ?? 0;
}
export function answerSigns(answer: string) { return new Set(answer.split(',').map(value => Number(value))); }
export { questionType } from '../question-types';
export function stateLabel(state: string) { return ({ mastered: '已记住', review: '待复习', unlearned: '未学习' })[state] ?? '未学习'; }
export const navigationStatus: QuestionNavigationStatus = {
  legend: ['unlearned', 'mastered', 'review'],
  label: stateLabel,
};
export function nearbyQuestion(rows: Summary[], current: number, delta: number) {
  const index = rows.findIndex(row => row.question_id === current);
  return rows[index + delta]?.question_id;
}

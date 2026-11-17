import { request, type Filters } from './client';
import type { Presentation, AttemptResult, PracticeSummary, PracticeOverview, Analysis, ReviewBook } from './generated/types.gen';
export type { PracticeDetail as Detail, PracticeSummary as Summary,
  PracticeOverview as Overview, Presentation, AttemptResult, Attempt,
  PublicQuestion, Analysis, ChapterAnalysis, Rate, ReviewBook, ReviewItem } from './generated/types.gen';
export type { Filters } from './client';

const json = (body: unknown): RequestInit => ({ method: 'POST',
  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export function questions(filters: Filters, signal?: AbortSignal) {
  const params = new URLSearchParams({ subject: String(filters.subject), state: filters.state });
  if (filters.chapter !== '') params.set('chapter', filters.chapter);
  if (filters.search) params.set('q', filters.search);
  if (filters.concept) params.set('concept', filters.concept);
  return request<PracticeSummary[]>(`/api/practice/questions?${params}`, { signal });
}
export const overview = (subject: number, signal?: AbortSignal) =>
  request<PracticeOverview>(`/api/practice/overview?subject=${subject}`, { signal });
export const presentation = (id: string, question: number, signal?: AbortSignal) =>
  request<Presentation>('/api/practice/presentations', { ...json({ id, question_id: question }), signal });
export const answer = (id: string, selected: number[], numeric?: string) =>
  request<AttemptResult>(`/api/practice/presentations/${id}/answer`, json({ selected, numeric }));
export const cursor = (subject: number, id: number, signal?: AbortSignal) =>
  request<{ saved: boolean }>('/api/practice/cursor', { ...json({ subject_id: subject, question_id: id }), method: 'PUT', signal });
export const analysis = (subject: number, days: number, signal?: AbortSignal) =>
  request<Analysis>(`/api/analysis?subject=${subject}&days=${days}`, { signal });
export const exposure = (id: string, question: number, signal?: AbortSignal) =>
  request<{ saved: boolean }>('/api/study/exposures', { ...json({ id, question_id: question }), signal });

export const reviewBook = (subject: number, signal?: AbortSignal) =>
  request<ReviewBook>(`/api/analysis/review-book?subject=${subject}`, { signal });

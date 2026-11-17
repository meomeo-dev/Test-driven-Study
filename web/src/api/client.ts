import type { QuestionDetail as Detail, QuestionSummary as Summary, SubjectOverview as Overview, ProgressState } from './generated/types.gen';
export type { Question, QuestionDetail as Detail, QuestionSummary as Summary, SubjectOverview as Overview, ProgressState } from './generated/types.gen';
export type Filters = {
  subject: number; chapter: string; state: string; search: string;
  // Practice only: limit the list to items tagged with one concept of the unit.
  concept?: string;
};

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body: unknown = await response.json();
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body
      ? String(body.error) : '暂时无法读取学习数据，请重试。';
    throw new Error(message);
  }
  return body as T;
}

export function questions(filters: Filters, signal?: AbortSignal) {
  const params = new URLSearchParams({ subject: String(filters.subject), state: filters.state });
  if (filters.chapter !== '') params.set('chapter', filters.chapter);
  if (filters.search) params.set('q', filters.search);
  return request<Summary[]>(`/api/questions?${params}`, { signal });
}
export const overview = (subject: number, signal?: AbortSignal) =>
  request<Overview>(`/api/study/overview?subject=${subject}`, { signal });
export const detail = (id: number, signal?: AbortSignal) =>
  request<Detail>(`/api/questions/${id}`, { signal });
export const progress = (id: number, state: ProgressState) =>
  request<{ state: ProgressState }>(`/api/questions/${id}/progress`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state }),
  });
export const cursor = (subject: number, id: number, signal?: AbortSignal) =>
  request<{ saved: boolean }>('/api/study/cursor', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject_id: subject, question_id: id }), signal,
  });

import { request } from './client';
import type { ExamRule, ExamSession, ExamSummary } from './generated/types.gen';
export type { ExamRule, ExamSession, ExamSummary, ExamItem } from './generated/types.gen';
const json = (body: unknown, method = 'POST'): RequestInit => ({ method,
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const rules = (subject: number, signal?: AbortSignal) => request<ExamRule>(`/api/exams/rules?subject=${subject}`, { signal });
export const history = (subject: number, signal?: AbortSignal) => request<ExamSummary[]>(`/api/exams?subject=${subject}`, { signal });
export const create = (id: string, subject: number) => request<ExamSession>('/api/exams', json({ id, subject_id: subject }));
export const get = (id: string, signal?: AbortSignal) => request<ExamSession>(`/api/exams/${encodeURIComponent(id)}`, { signal });
export const answer = (id: string, index: number, selected: number[]) => request<ExamSession>(`/api/exams/${encodeURIComponent(id)}/answer`, json({ index, selected }));
export const move = (id: string, index: number, flagged?: boolean) => request<ExamSession>(`/api/exams/${encodeURIComponent(id)}/cursor`, json({ index, flagged }, 'PUT'));
export const navigate = (id: string, from: number, target: number, selected: number[], numeric?: string) =>
  request<ExamSession>(`/api/exams/${encodeURIComponent(id)}/navigate`,
    json({ from_index: from, to_index: target, selected, numeric }));
export const submit = (id: string) => request<ExamSession>(`/api/exams/${encodeURIComponent(id)}/submit`, json({}));

import { request } from './client';
import type { PalaceCreate, PalaceInfo, PalaceJob, PalacePreview } from './generated/types.gen';
import type { ProviderSettings, ProviderUpdate, ProviderConnection } from './generated/types.gen';
import type { PalaceCoverage, TaskPage, TaskEvent } from './generated/types.gen';
import type { ImageRetryInput } from './generated/types.gen';
export type { ImageRetryInput } from './generated/types.gen';
export type { TaskSummary } from './generated/types.gen';
export type { PalaceSettings, PalaceJob, PalaceInfo, PalaceCreate } from './generated/types.gen';

const post = (body: unknown): RequestInit => ({ method: 'POST',
  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const info = (signal?: AbortSignal) =>
  request<PalaceInfo>('/api/palaces/info', { signal });
export const preview = (question: number, address: string, plan?: string) =>
  request<PalacePreview>('/api/palaces/preview', post({ question_id: question, palace_address: address, ...(plan ? { plan_id: plan } : {}) }));
export const create = (input: PalaceCreate) =>
  request<PalaceJob>('/api/palaces/jobs', post(input));
export const history = (subject: number, signal?: AbortSignal) =>
  request<PalaceJob[]>(`/api/palaces/jobs?subject=${subject}`, { signal });
export const coverage = (subject: number, signal?: AbortSignal) =>
  request<PalaceCoverage[]>(`/api/palaces/coverage?subject=${subject}`, { signal });
export const job = (id: string, signal?: AbortSignal) =>
  request<PalaceJob>(`/api/palaces/jobs/${encodeURIComponent(id)}`, { signal });
export const cancel = (id: string) =>
  request<PalaceJob>(`/api/palaces/jobs/${encodeURIComponent(id)}/cancel`, post({}));
export const imageURL = (id: string) => `/api/palaces/jobs/${encodeURIComponent(id)}/image`;
export const active = (value?: {status: string}) =>
  value?.status === 'queued' || value?.status === 'running' || value?.status === 'pausing';
export const unfinished = (value?: {status: string}) => active(value) || value?.status === 'paused';
export const statusLabel = { queued: '等待生成', running: '正在生成', succeeded: '已保存',
  pausing: '正在暂停', paused: '已暂停', failed: '生成失败', canceled: '已终止', interrupted: '服务中断' };

export const pause = (id: string) =>
  request<PalaceJob>(`/api/palaces/jobs/${id}/pause`, post({}));
export const resume = (id: string) =>
  request<PalaceJob>(`/api/palaces/jobs/${id}/resume`, post({}));
export const retry = (id: string, next: string) =>
  request<PalaceJob>(`/api/palaces/jobs/${id}/retry`, post({id: next}));
export const retryImage = (id: string, input: ImageRetryInput) =>
  request<PalaceJob>(`/api/palaces/jobs/${id}/retry-image`, post(input));
export const tasks = (scope: 'active' | 'all', before: string, signal?: AbortSignal, course = '') =>
  request<TaskPage>(`/api/tasks?${new URLSearchParams({scope, before, course})}`, {signal});
export const events = (id: string, signal?: AbortSignal) =>
  request<TaskEvent[]>(`/api/tasks/${id}/events`, {signal});

export type { ProviderSettings, ProviderUpdate } from './generated/types.gen';
const normalizeProviderSettings = (value: ProviderSettings): ProviderSettings => ({
  ...value,
  allow_direct_https: Boolean(value.allow_direct_https),
});
const normalizeProviderUpdate = (input: ProviderUpdate): ProviderUpdate => ({
  ...input,
  allow_direct_https: Boolean(input.allow_direct_https),
});
export const providerSettings = (signal?: AbortSignal) =>
  request<ProviderSettings>('/api/palaces/settings', { signal, cache: 'no-store' })
    .then(normalizeProviderSettings);
export function saveProvider(input: ProviderUpdate, token: string) {
  return request<ProviderSettings>('/api/palaces/settings', {
    ...post(normalizeProviderUpdate(input)),
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Settings-Token': token },
  }).then(normalizeProviderSettings);
}
export function testProvider(input: ProviderUpdate, token: string) {
  return request<ProviderConnection>('/api/palaces/settings/test', {
    ...post(normalizeProviderUpdate(input)),
    headers: { 'Content-Type': 'application/json', 'X-Settings-Token': token },
  });
}

export function stageLabel(job: PalaceJob) {
  if (job.status !== 'running' || !job.snapshot.pipeline) return statusLabel[job.status];
  return job.snapshot.pipeline.stage === 'planning' ? 'LLM 构思中' : '正在生图';
}

import { request } from './client';
import type { LlmInfo, LlmProviderSettings, LlmProviderUpdate, LlmPlanInput,
  LlmPlanRecord, ProviderConnection } from './generated/types.gen';
export type { LlmInfo, LlmProviderSettings, LlmProviderUpdate, LlmParameters,
  LlmPlanInput, LlmPlanRecord } from './generated/types.gen';

const post = (body: unknown): RequestInit => ({ method: 'POST',
  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const normalizeSettings = (value: LlmProviderSettings): LlmProviderSettings => ({
  ...value,
  allow_direct_https: Boolean(value.allow_direct_https),
});
const normalizeUpdate = (input: LlmProviderUpdate): LlmProviderUpdate => ({
  ...input,
  allow_direct_https: Boolean(input.allow_direct_https),
});
export const info = (signal?: AbortSignal) => request<LlmInfo>('/api/llm/info', { signal });
export const settings = (signal?: AbortSignal) =>
  request<LlmProviderSettings>('/api/llm/settings', { signal, cache: 'no-store' })
    .then(normalizeSettings);
export const create = (input: LlmPlanInput) => request<LlmPlanRecord>('/api/llm/plans', post(input));
export const plan = (id: string, signal?: AbortSignal) =>
  request<LlmPlanRecord>(`/api/llm/plans/${encodeURIComponent(id)}`, { signal });
export const save = (input: LlmProviderUpdate, token: string) =>
  request<LlmProviderSettings>('/api/llm/settings', {
    ...post(normalizeUpdate(input)),
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Settings-Token': token },
  }).then(normalizeSettings);
export const test = (input: LlmProviderUpdate, token: string) =>
  request<ProviderConnection>('/api/llm/settings/test', {
    ...post(normalizeUpdate(input)),
    headers: { 'Content-Type': 'application/json', 'X-Settings-Token': token },
  });

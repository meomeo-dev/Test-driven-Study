import { request } from './client';
import type { LlmInfo, LlmProviderSettings, LlmProviderUpdate, LlmPlanInput,
  LlmPlanRecord, ProviderConnection } from './generated/types.gen';
export type { LlmInfo, LlmProviderSettings, LlmProviderUpdate, LlmParameters,
  LlmPlanInput, LlmPlanRecord } from './generated/types.gen';

const post = (body: unknown): RequestInit => ({ method: 'POST',
  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const info = (signal?: AbortSignal) => request<LlmInfo>('/api/llm/info', { signal });
export const settings = (signal?: AbortSignal) =>
  request<LlmProviderSettings>('/api/llm/settings', { signal, cache: 'no-store' });
export const create = (input: LlmPlanInput) => request<LlmPlanRecord>('/api/llm/plans', post(input));
export const plan = (id: string, signal?: AbortSignal) =>
  request<LlmPlanRecord>(`/api/llm/plans/${encodeURIComponent(id)}`, { signal });
export const save = (input: LlmProviderUpdate, token: string) =>
  request<LlmProviderSettings>('/api/llm/settings', { ...post(input), method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Settings-Token': token } });
export const test = (input: LlmProviderUpdate, token: string) =>
  request<ProviderConnection>('/api/llm/settings/test', { ...post(input),
    headers: { 'Content-Type': 'application/json', 'X-Settings-Token': token } });

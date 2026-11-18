import { request } from './client';
import type {
  TtsProviderSettings,
  TtsProviderUpdate,
  TtsSynthesizeInput,
  TtsSynthesizeResult,
  ProviderConnection,
} from './generated/types.gen';
export type {
  TtsConfig,
  TtsProviderSettings,
  TtsProviderUpdate,
  TtsSynthesizeInput,
  TtsSynthesizeResult,
} from './generated/types.gen';

const post = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const settings = (signal?: AbortSignal) =>
  request<TtsProviderSettings>('/api/tts/settings', { signal, cache: 'no-store' });

export const save = (input: TtsProviderUpdate, token: string) =>
  request<TtsProviderSettings>('/api/tts/settings', {
    ...post(input),
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Settings-Token': token },
  });

export const test = (input: TtsProviderUpdate, token: string) =>
  request<ProviderConnection>('/api/tts/settings/test', {
    ...post(input),
    headers: { 'Content-Type': 'application/json', 'X-Settings-Token': token },
  });

export const synthesize = (input: TtsSynthesizeInput) =>
  request<TtsSynthesizeResult>('/api/tts/synthesize', post(input));

export const audioUrl = (voice: string, key: string) =>
  `/api/audio/${encodeURIComponent(voice)}/${encodeURIComponent(key)}.wav`;

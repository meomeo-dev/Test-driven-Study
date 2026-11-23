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

const normalizeSettings = (value: TtsProviderSettings): TtsProviderSettings => ({
  ...value,
  allow_direct_https: Boolean(value.allow_direct_https),
});

const normalizeUpdate = (input: TtsProviderUpdate): TtsProviderUpdate => ({
  ...input,
  allow_direct_https: Boolean(input.allow_direct_https),
});

export const settings = (signal?: AbortSignal) =>
  request<TtsProviderSettings>('/api/tts/settings', { signal, cache: 'no-store' })
    .then(normalizeSettings);

export const save = (input: TtsProviderUpdate, token: string) =>
  request<TtsProviderSettings>('/api/tts/settings', {
    ...post(normalizeUpdate(input)),
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Settings-Token': token },
  }).then(normalizeSettings);

export const test = (input: TtsProviderUpdate, token: string) =>
  request<ProviderConnection>('/api/tts/settings/test', {
    ...post(normalizeUpdate(input)),
    headers: { 'Content-Type': 'application/json', 'X-Settings-Token': token },
  });

export const synthesize = (input: TtsSynthesizeInput) =>
  request<TtsSynthesizeResult>('/api/tts/synthesize', post(input));

export const audioUrl = (voice: string, key: string) =>
  `/api/audio/${encodeURIComponent(voice)}/${encodeURIComponent(key)}.wav`;

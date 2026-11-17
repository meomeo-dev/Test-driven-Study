import type { ImageRetryInput } from '../../api/palace';
import { readPreferences, type Preferences } from './preferences';

const key = 'test-driven-study.image-retry.v1.';
const pending = new Map<string, ImageRetryInput>();

export function pendingImageRetry(source: string): ImageRetryInput | undefined {
  try {
    const raw = sessionStorage.getItem(key + source);
    if (raw) {
      const value = JSON.parse(raw);
      if (typeof value.id === 'string' && /^[a-f0-9-]{36}$/i.test(value.id)) {
        return {id: value.id, ...readPreferences(raw, '')};
      }
    }
  } catch { /* Memory still prevents duplicate requests when storage is blocked. */ }
  return pending.get(source);
}

export function imageRetryRequest(source: string, value: Preferences): ImageRetryInput {
  const previous = pendingImageRetry(source);
  const same = previous && Object.entries(value).every(([key, v]) =>
    previous[key as keyof Preferences] === v);
  const request = same ? previous : {id: crypto.randomUUID(), ...value};
  pending.set(source, request);
  // Store only public image parameters and the idempotency key, never prompts or secrets.
  try { sessionStorage.setItem(key + source, JSON.stringify(request)); }
  catch { /* The in-memory entry remains usable for this page. */ }
  return request;
}

export function clearImageRetry(source: string, id: string) {
  if (pendingImageRetry(source)?.id !== id) return;
  pending.delete(source);
  try { sessionStorage.removeItem(key + source); }
  catch { /* Storage may be unavailable; the server also enforces idempotency. */ }
}

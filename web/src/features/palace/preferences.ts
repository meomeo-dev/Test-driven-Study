export type AspectRatio = '9:16' | '2:3';
export type Resolution = '1k' | '2k' | '4k';
export type Preferences = { model: string; aspect_ratio: AspectRatio;
  resolution: Resolution; quality: 'low' | 'medium' | 'high' };
export const preferenceKey = 'test-driven-study.palace-preferences.v1';
export const preferenceEvent = `${preferenceKey}.change`;
export const sizes: Record<AspectRatio, Record<Resolution, string>> = outputSizes;
export function validSize(size: string) {
  const match = /^([1-9]\d*)x([1-9]\d*)$/.exec(size);
  if (!match) return false;
  const width = Number(match[1]), height = Number(match[2]);
  const pixels = width * height;
  return Math.max(width, height) <= 3840 && width % 16 === 0 && height % 16 === 0
    && Math.max(width, height) <= 3 * Math.min(width, height)
    && pixels >= 655360 && pixels <= 8294400;
}
export function readPreferences(raw: string | null, model: string): Preferences {
  const fallback: Preferences = { model, aspect_ratio: '9:16', resolution: '2k', quality: 'medium' };
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;
    const p = parsed as Record<string, unknown>;
    return { model: typeof p.model === 'string' && p.model.length <= 100 ? p.model : model,
      aspect_ratio: p.aspect_ratio === '2:3' ? '2:3' : '9:16',
      resolution: p.resolution === '1k' || p.resolution === '4k' ? p.resolution : '2k',
      quality: p.quality === 'low' || p.quality === 'high' ? p.quality : 'medium' };
  } catch { return fallback; }
}
export function imagePreferences(settings: {model: string; quality: Preferences['quality'];
  size: string; aspect_ratio?: AspectRatio; resolution?: Resolution}): Preferences {
  const value = readPreferences(JSON.stringify(settings), settings.model);
  if (!settings.aspect_ratio && settings.size.startsWith('1024x1536')) value.aspect_ratio = '2:3';
  for (const ratio of ['9:16', '2:3'] as const) for (const tier of ['1k', '2k', '4k'] as const) {
    if (sizes[ratio][tier] === settings.size) return {...value, aspect_ratio: ratio, resolution: tier};
  }
  return value;
}
import outputSizes from '../../../../internal/palace/output-sizes.json';

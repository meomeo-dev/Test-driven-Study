import { describe, expect, it } from 'vitest';
import { readPreferences, sizes, validSize } from './preferences';

describe('palace image preferences', () => {
  it('accepts only sizes within the imagegen script constraints', () => {
    for (const [ratio, tiers] of Object.entries(sizes)) for (const size of Object.values(tiers)) {
      expect(validSize(size)).toBe(true);
      const [width, height] = size.split('x').map(Number);
      expect(width! / height!).toBeCloseTo(ratio === '9:16' ? 9 / 16 : 2 / 3, 10);
    }
    for (const size of ['576x1024', '2560x3840', '721x1280', '4096x2160', '0x1024', 'foo']) {
      expect(validSize(size)).toBe(false);
    }
  });
  it('restores only generation parameters and handles corrupt preferences', () => {
    const saved = JSON.stringify({ model: 'gpt-image-2', quality: 'high',
      resolution: '4k', aspect_ratio: '2:3', api_key: 'must-not-be-restored' });
    expect(readPreferences(saved, '')).toEqual({ model: 'gpt-image-2', quality: 'high',
      resolution: '4k', aspect_ratio: '2:3' });
    for (const raw of ['invalid', 'null', '[]', '{"resolution":"8k"}']) {
      expect(readPreferences(raw, 'default').resolution).toBe('2k');
    }
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultWindow, fitWindow, readWindow, resizedWindow } from './windowGeometry';

afterEach(() => vi.unstubAllGlobals());

describe('assistant window bounds', () => {
  it.each([[1440, 900], [1280, 600], [390, 844], [320, 568], [844, 390]])(
    'keeps the default window reachable in a %i by %i viewport', (width, height) => {
      const rect = defaultWindow({ width, height });
      expect(rect.x).toBeGreaterThanOrEqual(12);
      expect(rect.y).toBeGreaterThanOrEqual(12);
      expect(rect.x + rect.width).toBeLessThanOrEqual(width - 12);
      expect(rect.y + rect.height).toBeLessThanOrEqual(height - 12);
      expect(rect.width).toBeGreaterThanOrEqual(296);
      expect(rect.height).toBeGreaterThanOrEqual(300);
      expect(rect.y).toBe(12);
      expect(rect.height).toBe(height - 24);
    },
  );

  it('recovers a large saved rectangle inside a narrow viewport', () => {
    expect(fitWindow({ x: 9999, y: -900, width: 9000, height: 9000 },
      { width: 320, height: 568 })).toEqual({ x: 12, y: 12, width: 296, height: 544 });
  });

  it('resizes independently while keeping the top-left corner fixed', () => {
    const origin = { x: 1000, y: 300, width: 400, height: 500 };
    const viewport = { width: 1440, height: 900 };
    expect(resizedWindow(origin, { x: 9999, y: 9999 }, viewport))
      .toEqual({ x: 1000, y: 300, width: 428, height: 588 });
    expect(resizedWindow(origin, { x: -9999, y: -9999 }, viewport))
      .toEqual({ x: 1000, y: 300, width: 300, height: 300 });
  });

  it.each(['null', '{bad-json', '{"x":1,"y":2,"width":"wide","height":400}'])(
    'ignores an obsolete or malformed stored value %s', value => {
      vi.stubGlobal('window', { innerWidth: 1280, innerHeight: 720 });
      vi.stubGlobal('localStorage', { getItem: () => value });
      expect(readWindow()).toEqual(defaultWindow({ width: 1280, height: 720 }));
    },
  );

  it('keeps the window usable when preference storage is blocked', () => {
    vi.stubGlobal('window', { innerWidth: 390, innerHeight: 844 });
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); } });
    expect(readWindow()).toEqual(defaultWindow({ width: 390, height: 844 }));
  });
});

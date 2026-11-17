import { describe, expect, it } from 'vitest';
import { blockedKeyEvent, shortcutCommand, type ShortcutEvent } from './shortcuts';

const clean: ShortcutEvent = {
  defaultPrevented: false, ctrlKey: false, altKey: false,
  metaKey: false, isComposing: false, keyCode: 0,
};

describe('study shortcuts', () => {
  it('adapts Vim navigation while keeping first and last case-sensitive', () => {
    expect(shortcutCommand('j', false)).toBe('next');
    expect(shortcutCommand('k', false)).toBe('previous');
    expect(shortcutCommand('g', false)).toBe('prefix');
    expect(shortcutCommand('g', true)).toBe('first');
    expect(shortcutCommand('G', false)).toBe('last');
    expect(shortcutCommand('/', false)).toBe('search');
    expect(shortcutCommand('J', false)).toBeUndefined();
  });
  it('keeps application mutations distinct and leaves native Enter/Space alone', () => {
    expect(shortcutCommand('m', false)).toBe('master');
    expect(shortcutCommand('r', false)).toBe('review');
    expect(shortcutCommand('u', false)).toBe('clear');
    expect(shortcutCommand('f', false)).toBe('image');
    expect(shortcutCommand('v', false)).toBe('details');
    expect(shortcutCommand('n', false)).toBe('navigation');
    expect(shortcutCommand('?', false)).toBe('help');
    expect(shortcutCommand('Enter', false)).toBeUndefined();
    expect(shortcutCommand(' ', false)).toBeUndefined();
  });
  it('protects browser modifiers, handled events, and IME boundaries', () => {
    expect(blockedKeyEvent(clean)).toBe(false);
    for (const property of ['ctrlKey', 'altKey', 'metaKey', 'defaultPrevented', 'isComposing'] as const) {
      expect(blockedKeyEvent({ ...clean, [property]: true })).toBe(true);
    }
    expect(blockedKeyEvent({ ...clean, keyCode: 229 })).toBe(true);
  });
});

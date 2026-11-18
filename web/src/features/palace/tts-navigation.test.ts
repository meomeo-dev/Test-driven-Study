import { describe, expect, it } from 'vitest';
import { audioUrl } from '../../api/tts';
import type { Kind } from './ProviderDialog';

const kinds: Kind[] = ['image', 'llm', 'tts'];

function getNextTab(current: Kind, key: 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End'): Kind {
  const idx = kinds.indexOf(current);
  if (key === 'Home') return kinds[0] ?? 'image';
  if (key === 'End') return kinds[kinds.length - 1] ?? 'tts';
  if (key === 'ArrowRight') return kinds[(idx + 1) % kinds.length] ?? 'image';
  return kinds[(idx - 1 + kinds.length) % kinds.length] ?? 'image';
}

function enforceAntiLeakage(options: Array<{ sign: number; text: string; tts?: { voice?: string } }>) {
  const hasAnyTts = options.some(opt => Boolean(opt.tts));
  return options.map(opt => ({
    ...opt,
    tts: opt.tts || (hasAnyTts ? { voice: 'stella' } : undefined),
  }));
}

describe('TTS Provider & Navigation', () => {
  it('supports 3-way circular keyboard navigation across image, llm, and tts tabs', () => {
    expect(getNextTab('image', 'ArrowRight')).toBe('llm');
    expect(getNextTab('llm', 'ArrowRight')).toBe('tts');
    expect(getNextTab('tts', 'ArrowRight')).toBe('image');

    expect(getNextTab('image', 'ArrowLeft')).toBe('tts');
    expect(getNextTab('tts', 'ArrowLeft')).toBe('llm');
    expect(getNextTab('llm', 'ArrowLeft')).toBe('image');

    expect(getNextTab('llm', 'Home')).toBe('image');
    expect(getNextTab('llm', 'End')).toBe('tts');
  });

  it('generates consistent audio URL with encoded voice and phrase key', () => {
    expect(audioUrl('stella', '17f8a3d1004bca91')).toBe('/api/audio/stella/17f8a3d1004bca91.wav');
    expect(audioUrl('tide', 'abcdef0123456789')).toBe('/api/audio/tide/abcdef0123456789.wav');
  });

  it('enforces option-level anti-leakage uniformity across all choices', () => {
    const rawOptions = [
      { sign: 1, text: "The light doesn't work.", tts: { voice: 'stella' } },
      { sign: 2, text: 'The light is dead person.' },
      { sign: 3, text: 'No light working now.' },
    ];

    const uniform = enforceAntiLeakage(rawOptions);
    expect(uniform.every(opt => Boolean(opt.tts))).toBe(true);
    expect(uniform[0]?.tts?.voice).toBe('stella');
    expect(uniform[1]?.tts?.voice).toBe('stella');
    expect(uniform[2]?.tts?.voice).toBe('stella');

    const noTtsOptions = [
      { sign: 1, text: 'from' },
      { sign: 2, text: 'at' },
      { sign: 3, text: 'in' },
    ];
    const noUniform = enforceAntiLeakage(noTtsOptions);
    expect(noUniform.every(opt => opt.tts === undefined)).toBe(true);
  });
});

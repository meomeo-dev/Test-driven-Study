import { describe, expect, it } from 'vitest';
import type { VocabularyEntry } from '../../api/generated/types.gen';
import {
  posLabels,
  resolveExampleSpeech,
  resolveSpeechTarget,
  resolveTermSpeech,
  stripEllipsisPlaceholder,
} from './model';

function makeEntry(overrides: Partial<VocabularyEntry> = {}): VocabularyEntry {
  return {
    id: 'glove',
    unit_id: 'extended-practice',
    term: 'glove',
    meaning: '手套',
    category: 'word',
    ...overrides,
  };
}

describe('vocabulary model', () => {
  it('maps all POS codes to Chinese display labels', () => {
    expect(posLabels).toEqual({
      n: '名词',
      v: '动词',
      adj: '形容词',
      adv: '副词',
      prep: '介词',
      pron: '代词',
      num: '数词',
      conj: '连词',
      interj: '感叹词',
    });
  });

  it('strips Unicode and ASCII ellipsis placeholders without leaving orphan spaces', () => {
    expect(stripEllipsisPlaceholder('My name is …')).toBe('My name is');
    expect(stripEllipsisPlaceholder('Could you please …?')).toBe('Could you please?');
    expect(stripEllipsisPlaceholder('Could you please ...?')).toBe('Could you please?');
    expect(stripEllipsisPlaceholder('Wait ... here.')).toBe('Wait here.');
    expect(stripEllipsisPlaceholder('…')).toBe('');
  });

  it('prefers explicit tts.text override and preserves voice and speed', () => {
    const entry = makeEntry({
      term: 'My name is …',
      term_tts: { text: 'My name is.', voice: 'tide', speed: 0.9 },
      example: 'My name is Mia Chen.',
      example_tts: { voice: 'stella', speed: 1.1 },
    });

    expect(resolveTermSpeech(entry)).toEqual({
      text: 'My name is.',
      voice: 'tide',
      speed: 0.9,
    });
    expect(resolveExampleSpeech(entry)).toEqual({
      text: 'My name is Mia Chen.',
      voice: 'stella',
      speed: 1.1,
    });
  });

  it('falls back to stripped term/example text when explicit tts.text is absent', () => {
    const entry = makeEntry({
      term: 'Could you please …?',
      term_tts: { voice: 'stella' },
      example: 'Could you please pass the wrench?',
    });

    expect(resolveTermSpeech(entry)).toEqual({
      text: 'Could you please?',
      voice: 'stella',
      speed: undefined,
    });
    expect(resolveExampleSpeech(entry)).toEqual({
      text: 'Could you please pass the wrench?',
      voice: undefined,
      speed: undefined,
    });
  });

  it('returns undefined when example or speakable text is empty', () => {
    expect(resolveExampleSpeech(makeEntry())).toBeUndefined();
    expect(resolveSpeechTarget('   …   ')).toBeUndefined();
    expect(resolveSpeechTarget(undefined, { text: '   ' })).toBeUndefined();
  });
});

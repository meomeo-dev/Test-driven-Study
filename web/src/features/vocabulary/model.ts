import type { TtsConfig, VocabularyEntry } from '../../api/generated/types.gen';

export type Category = VocabularyEntry['category'];
export type Pos = NonNullable<VocabularyEntry['pos']>;
export type Scope = 'question' | 'unit' | 'course';

export type SpeechTarget = {
  text: string;
  voice?: TtsConfig['voice'];
  speed?: TtsConfig['speed'];
};

export const categories: Record<Category, string> = {
  word: '单词',
  word_group: '词组',
  phrase: '短语',
  collocation: '固定搭配',
  idiom: '习语／惯用语',
  function_phrase: '介词／功能短语',
};

export const posLabels: Record<Pos, string> = {
  n: '名词',
  v: '动词',
  adj: '形容词',
  adv: '副词',
  prep: '介词',
  pron: '代词',
  num: '数词',
  conj: '连词',
  interj: '感叹词',
};

export const scopes: Record<Scope, string> = {
  question: '本题',
  unit: '本单元',
  course: '全课程',
};

/**
 * Strip ellipsis placeholders (`…` or `...`) when an entry has no explicit TTS override
 * so display strings like `"Could you please …?"` synthesize cleanly.
 */
export function stripEllipsisPlaceholder(text: string): string {
  return text
    .replace(/\s*(?:…|\.{3,})\s*/g, ' ')
    .replace(/\s+([?.!,;:])/g, '$1')
    .trim();
}

/** Resolve the speech payload for a vocabulary field, preferring explicit `tts.text`. */
export function resolveSpeechTarget(
  source?: string,
  tts?: TtsConfig,
): SpeechTarget | undefined {
  const explicit = tts?.text?.trim();
  const text = explicit || (source ? stripEllipsisPlaceholder(source) : '');
  if (!text) return undefined;
  return {
    text,
    voice: tts?.voice,
    speed: tts?.speed,
  };
}

/** Resolve the TTS target for an entry's `term`. */
export function resolveTermSpeech(entry: VocabularyEntry): SpeechTarget | undefined {
  return resolveSpeechTarget(entry.term, entry.term_tts);
}

/** Resolve the TTS target for an entry's `example`, if present. */
export function resolveExampleSpeech(entry: VocabularyEntry): SpeechTarget | undefined {
  return resolveSpeechTarget(entry.example, entry.example_tts);
}

/** Whether a vocabulary entry is linked to the active unit and question. */
export function matchesQuestionEntry(
  entry: VocabularyEntry,
  unitId: string,
  questionId?: string,
): boolean {
  return entry.unit_id === unitId
    && questionId !== undefined
    && Boolean(entry.question_ids?.includes(questionId));
}

/** Filter vocabulary entries by active scope, category, and search keyword. */
export function filterVocabularyEntries(
  entries: VocabularyEntry[],
  opts: {
    scope: Scope;
    unitId: string;
    questionId?: string;
    category: Category | '';
    search: string;
  },
): VocabularyEntry[] {
  const keyword = opts.search.trim().toLowerCase();
  return entries.filter(entry => {
    if (opts.scope === 'question'
      && !matchesQuestionEntry(entry, opts.unitId, opts.questionId)) return false;
    if (opts.scope === 'unit' && entry.unit_id !== opts.unitId) return false;
    if (opts.category && entry.category !== opts.category) return false;
    return entry.term.toLowerCase().includes(keyword)
      || entry.meaning.toLowerCase().includes(keyword);
  });
}

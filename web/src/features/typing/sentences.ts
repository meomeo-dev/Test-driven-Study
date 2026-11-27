import type {
  CourseOption,
  PinyinClips,
  RichText,
  TtsConfig,
  TtsDeclaration,
} from '../../api/generated/types.gen';
import type { HighlightSpan } from './engine';

export type TypingSentenceRole =
  | 'stem'
  | 'passage'
  | 'transcript'
  | 'sub_question'
  | 'answer';

export type TypingLanguage = 'en' | 'zh' | 'mixed' | 'neutral';
export type TypingScope = 'all' | 'english' | 'answers';

export type TypingSpeech =
  | { kind: 'tts'; text: string; voice?: 'stella' | 'tide'; speed?: number }
  | { kind: 'pinyin'; text: string; pinyin: PinyinClips };

export type TypingSentence = {
  id: string;
  role: TypingSentenceRole;
  roleLabel: string;
  text: string;
  language: TypingLanguage;
  hint?: string;
  speech?: TypingSpeech;
  highlights?: HighlightSpan[];
};

export type SpanSlice = { text: string; start: number; end: number };

const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff]/g;
const LATIN_RE = /[A-Za-z]/g;
const ABBREVIATIONS = new Set([
  'mr.', 'mrs.', 'ms.', 'dr.', 'prof.', 'sr.', 'jr.', 'st.', 'no.', 'vs.',
  'e.g.', 'i.e.', 'etc.',
]);
const TIME_ABBREVIATIONS = new Set(['a.m.', 'p.m.']);
const OPENERS = new Set(['(', '（', '“', '「', '『', '《', '【', '[']);
const CLOSERS = new Set([')', '）', '”', '」', '』', '》', '】', ']']);

export function detectSentenceLanguage(
  text: string,
  courseLanguage?: string,
): TypingLanguage {
  const cjkCount = text.match(CJK_RE)?.length ?? 0;
  const latinCount = text.match(LATIN_RE)?.length ?? 0;
  if (cjkCount > 0 && latinCount > 0) return 'mixed';
  if (cjkCount > 0) return 'zh';
  if (latinCount > 0) return 'en';
  if (courseLanguage?.toLowerCase().startsWith('en')) return 'en';
  return 'neutral';
}

export function languageBadgeLabel(language: TypingLanguage): string {
  switch (language) {
    case 'en': return 'EN';
    case 'zh': return '中文';
    case 'mixed': return '中英';
    case 'neutral': return '通用';
  }
}

function trailingWord(chunk: string): string {
  const match = chunk.match(/([A-Za-z.]+)$/);
  return match ? match[1]!.toLowerCase() : '';
}

function isSentenceSplit(text: string, index: number, depth: number): boolean {
  if (depth > 0) return false;
  const ch = text[index]!;
  if (ch === '。' || ch === '！' || ch === '？') return true;
  if (ch !== '.' && ch !== '!' && ch !== '?') return false;
  const next = text[index + 1];
  if (!next || !/\s/.test(next)) return false;
  if (ch === '.') {
    const word = trailingWord(text.slice(0, index + 1));
    if (ABBREVIATIONS.has(word)) return false;
    if (TIME_ABBREVIATIONS.has(word)) {
      const rest = text.slice(index + 1).trimStart();
      return /^[A-Z\u3400-\u9fff]/.test(rest[0] ?? '');
    }
  }
  return true;
}

function pushTrimmedSlice(
  target: SpanSlice[],
  source: string,
  rawStart: number,
  rawEnd: number,
) {
  let start = rawStart;
  let end = rawEnd;
  while (start < end && /\s/.test(source[start]!)) start += 1;
  while (end > start && /\s/.test(source[end - 1]!)) end -= 1;
  if (end <= start) return;
  const text = source.slice(start, end).replace(/\s+/g, ' ');
  if (text) target.push({ text, start, end });
}

export function splitParagraphWithOffsets(paragraph: string): SpanSlice[] {
  const result: SpanSlice[] = [];
  let depth = 0;
  let quoteOpen = false;
  let start = 0;

  for (let i = 0; i < paragraph.length; i += 1) {
    const ch = paragraph[i]!;
    if (ch === '"') quoteOpen = !quoteOpen;
    else if (OPENERS.has(ch)) depth += 1;
    else if (CLOSERS.has(ch) && depth > 0) depth -= 1;

    if (!isSentenceSplit(paragraph, i, quoteOpen ? depth + 1 : depth)) continue;
    let end = i + 1;
    while (end < paragraph.length && (CLOSERS.has(paragraph[end]!) || paragraph[end] === '"')) {
      end += 1;
    }
    pushTrimmedSlice(result, paragraph, start, end);
    i = end - 1;
    start = end;
  }
  pushTrimmedSlice(result, paragraph, start, paragraph.length);
  return result;
}

export function splitIntoSentences(text: string): string[] {
  return text
    .split(/\r?\n+/)
    .flatMap(paragraph => splitParagraphWithOffsets(paragraph).map(slice => slice.text));
}

export function alignSentencesWithTranslation(
  sentences: readonly string[],
  translation?: string,
  courseLanguage?: string,
): (string | undefined)[] {
  const trimmed = translation?.trim();
  if (!trimmed || !sentences.length) return sentences.map(() => undefined);
  if (sentences.length === 1) return [trimmed];
  const translatedParts = splitIntoSentences(trimmed);
  if (translatedParts.length === sentences.length) return translatedParts;
  const hasEnglish = sentences.some(part => {
    const lang = detectSentenceLanguage(part, courseLanguage);
    return lang === 'en' || lang === 'mixed';
  });
  return sentences.map(part => {
    if (!hasEnglish) return trimmed;
    const lang = detectSentenceLanguage(part, courseLanguage);
    return lang === 'en' || lang === 'mixed' ? trimmed : undefined;
  });
}

export function richTextToPlain(content?: RichText): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  return content.map(segment => segment.text ?? (segment.type === 'blank' ? '___' : '')).join('');
}

export function toSpeech(
  text: string,
  tts?: TtsDeclaration,
  pinyin?: PinyinClips,
  ttsText?: string,
): TypingSpeech | undefined {
  if (pinyin?.length) return { kind: 'pinyin', text, pinyin };
  if (!tts && !ttsText) return undefined;
  const config = typeof tts === 'object' ? tts : undefined;
  const spoken = (ttsText || config?.text || text).trim();
  if (!spoken) return undefined;
  return { kind: 'tts', text: spoken, voice: config?.voice, speed: config?.speed };
}

export function configToSpeech(text: string, config?: TtsConfig): TypingSpeech | undefined {
  if (!config) return undefined;
  const spoken = (config.text || text).trim();
  return spoken ? { kind: 'tts', text: spoken, voice: config.voice, speed: config.speed } : undefined;
}

export function resolveOptionTexts(options: CourseOption[], ids?: string[]): CourseOption[] {
  if (!ids?.length) return [];
  const chosen = new Set(ids);
  return options.filter(option => chosen.has(option.id));
}

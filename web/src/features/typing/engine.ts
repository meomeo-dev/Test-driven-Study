export type TypingCharState = 'correct' | 'wrong' | 'pending' | 'upcoming';

export type TypingCharCell = {
  char: string;
  state: TypingCharState;
  highlighted: boolean;
};

export type HighlightSpan = {
  start: number;
  end: number;
};

export type ImeState = {
  isComposing: boolean;
  compositionStart: number;
  compositionText: string;
};

export type TypingEvaluation = {
  cells: TypingCharCell[];
  extraWrong: string;
  composingPreview: string;
  matchedCount: number;
  wrongCount: number;
  hasError: boolean;
  imePending: boolean;
  isComplete: boolean;
};

const CJK_CHAR_RE = /[\u3400-\u4dbf\u4e00-\u9fff]/;
const ASCII_PINYIN_RE = /^[a-zA-Z' ]+$/;
const LATIN_WORD_RE = /[A-Za-z0-9']/;
const PUNCTUATION_MAP: Record<string, string> = {
  '\u2018': "'",
  '\u2019': "'",
  '\u201c': '"',
  '\u201d': '"',
  '\u2013': '-',
  '\u2014': '-',
  '\u2212': '-',
  '\uff0c': ',',
  '\u3002': '.',
  '\uff1f': '?',
  '\uff01': '!',
  '\uff1a': ':',
  '\uff1b': ';',
  '\uff08': '(',
  '\uff09': ')',
  '\u300c': '[',
  '\u300d': ']',
  '\u300e': '[',
  '\u300f': ']',
  '\u3010': '[',
  '\u3011': ']',
  '\u3001': ',',
};

export function isCjkChar(char: string): boolean {
  return CJK_CHAR_RE.test(char);
}

export function isAsciiPinyinFragment(text: string): boolean {
  return text.length > 0 && ASCII_PINYIN_RE.test(text);
}

export function normalizeComparableChar(char: string): string {
  if (/^\s$/u.test(char)) return ' ';
  const mapped = PUNCTUATION_MAP[char];
  if (mapped !== undefined) return mapped;
  return /^[A-Z]$/.test(char) ? char.toLowerCase() : char;
}

export function charsMatch(expected: string, actual: string): boolean {
  if (expected === actual) return true;
  return normalizeComparableChar(expected) === normalizeComparableChar(actual);
}

function isHighlighted(index: number, spans?: HighlightSpan[]): boolean {
  if (!spans?.length) return false;
  return spans.some(span => index >= span.start && index < span.end);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function splitCommittedAndComposing(rawInput: string, ime: ImeState): {
  committed: string;
  composing: string;
} {
  if (!ime.isComposing) return { committed: rawInput, composing: '' };
  const anchor = clamp(ime.compositionStart, 0, rawInput.length);
  const committed = rawInput.slice(0, anchor);
  const composing = ime.compositionText || rawInput.slice(anchor);
  return { committed, composing };
}

export function evaluateTyping(
  target: string,
  rawInput: string,
  ime: ImeState,
  highlights?: HighlightSpan[],
): TypingEvaluation {
  const targetChars = Array.from(target);
  const { committed, composing } = splitCommittedAndComposing(rawInput, ime);
  const inputChars = Array.from(committed);
  const cells: TypingCharCell[] = [];
  let matchedCount = 0;
  let wrongCount = 0;
  let imePending = ime.isComposing;
  let composingPreview = composing;
  let extraWrong = '';

  let evaluatedLength = inputChars.length;
  if (!ime.isComposing && inputChars.length > 0) {
    // Guard Chinese targets even if an IME drops compositionstart events:
    // trailing raw ASCII Pinyin against an expected CJK character stays pending.
    let firstMismatch = 0;
    while (
      firstMismatch < inputChars.length &&
      firstMismatch < targetChars.length &&
      charsMatch(targetChars[firstMismatch]!, inputChars[firstMismatch]!)
    ) {
      firstMismatch += 1;
    }
    if (firstMismatch < inputChars.length && firstMismatch < targetChars.length) {
      const expectedChar = targetChars[firstMismatch]!;
      const trailing = inputChars.slice(firstMismatch).join('');
      if (isCjkChar(expectedChar) && isAsciiPinyinFragment(trailing)) {
        evaluatedLength = firstMismatch;
        imePending = true;
        composingPreview = trailing;
      }
    }
  }

  for (let i = 0; i < targetChars.length; i += 1) {
    const expected = targetChars[i]!;
    const highlighted = isHighlighted(i, highlights);
    if (i < evaluatedLength) {
      const matched = charsMatch(expected, inputChars[i]!);
      if (matched) matchedCount += 1;
      else wrongCount += 1;
      cells.push({ char: expected, state: matched ? 'correct' : 'wrong', highlighted });
    } else if (i === evaluatedLength && imePending) {
      cells.push({ char: expected, state: 'pending', highlighted });
    } else {
      cells.push({ char: expected, state: 'upcoming', highlighted });
    }
  }

  if (evaluatedLength > targetChars.length) {
    extraWrong = inputChars.slice(targetChars.length, evaluatedLength).join('');
    wrongCount += Array.from(extraWrong).length;
  }

  const hasError = wrongCount > 0;
  const isComplete =
    !ime.isComposing &&
    !imePending &&
    !hasError &&
    targetChars.length > 0 &&
    matchedCount === targetChars.length;

  return {
    cells,
    extraWrong,
    composingPreview,
    matchedCount,
    wrongCount,
    hasError,
    imePending,
    isComplete,
  };
}

export function nextHintPrefix(target: string, currentInput: string): string {
  const targetChars = Array.from(target);
  const inputChars = Array.from(currentInput);
  let matched = 0;
  while (
    matched < targetChars.length &&
    matched < inputChars.length &&
    charsMatch(targetChars[matched]!, inputChars[matched]!)
  ) {
    matched += 1;
  }
  if (matched >= targetChars.length) return target;

  let nextEnd = matched;
  while (nextEnd < targetChars.length && /^\s$/u.test(targetChars[nextEnd]!)) {
    nextEnd += 1;
  }
  if (nextEnd >= targetChars.length) return target;

  if (LATIN_WORD_RE.test(targetChars[nextEnd]!)) {
    while (
      nextEnd < targetChars.length &&
      (LATIN_WORD_RE.test(targetChars[nextEnd]!) || targetChars[nextEnd] === '-')
    ) {
      nextEnd += 1;
    }
  } else {
    nextEnd += 1;
  }
  return targetChars.slice(0, nextEnd).join('');
}

export function buildRecallDisplay(target: string, revealedCount: number): string[] {
  const chars = Array.from(target);
  return chars.map((char, index) => {
    if (index < revealedCount) return char;
    if (/^\s$/u.test(char)) return char;
    if (isCjkChar(char)) return '\uff3f';
    if (/[A-Za-z]/.test(char)) {
      const prev = index > 0 ? chars[index - 1]! : '';
      const isWordStart = index === 0 || !LATIN_WORD_RE.test(prev);
      return isWordStart ? char : '_';
    }
    if (/[0-9]/.test(char)) return '_';
    return char;
  });
}

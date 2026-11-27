import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Question } from '../../api/generated/types.gen';
import { stopGlobalAudio } from '../../components/AudioControls';
import { evaluateTyping, nextHintPrefix, type ImeState } from './engine';
import {
  extractTypingSentences,
  filterTypingSentences,
  type TypingScope,
} from './extract';
import type { DisplayMode } from './TypingLine';

export const EMPTY_IME: ImeState = {
  isComposing: false,
  compositionStart: 0,
  compositionText: '',
};

export function useTypingSession(
  question: Question,
  courseLanguage: string | undefined,
  open: boolean,
) {
  const rollRef = useRef<HTMLDivElement>(null);
  const activeInputRef = useRef<HTMLTextAreaElement | null>(null);
  const lineRefs = useRef(new Map<number, HTMLDivElement>());
  const prevWrongRef = useRef(0);

  const allSentences = useMemo(
    () => extractTypingSentences(question, courseLanguage),
    [question, courseLanguage],
  );
  const hasEnglishAndOther = useMemo(
    () => allSentences.some(s => s.language === 'en') && allSentences.some(s => s.language !== 'en'),
    [allSentences],
  );
  const hasAnswersAndOther = useMemo(
    () => allSentences.some(s => s.role === 'answer') && allSentences.some(s => s.role !== 'answer'),
    [allSentences],
  );

  const [scope, setScope] = useState<TypingScope>('all');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('guided');
  const [activeIndex, setActiveIndex] = useState(0);
  const [rawInput, setRawInput] = useState('');
  const [ime, setIme] = useState<ImeState>(EMPTY_IME);
  const [lineStates, setLineStates] = useState<Record<string, 'done' | 'skipped'>>({});
  const [stats, setStats] = useState({ typed: 0, mistakes: 0, startedAt: 0 });
  const [finished, setFinished] = useState(false);
  const [ttsError, setTtsError] = useState<string>();

  const sentences = useMemo(
    () => filterTypingSentences(allSentences, scope),
    [allSentences, scope],
  );
  const activeSentence = !finished ? sentences[activeIndex] : undefined;
  const evaluation = useMemo(
    () => activeSentence
      ? evaluateTyping(activeSentence.text, rawInput, ime, activeSentence.highlights)
      : undefined,
    [activeSentence, rawInput, ime],
  );

  const focusInput = useCallback(() => {
    window.requestAnimationFrame(() => activeInputRef.current?.focus({ preventScroll: true }));
  }, []);

  const resetSession = useCallback((nextScope?: TypingScope) => {
    if (nextScope) setScope(nextScope);
    setActiveIndex(0);
    setRawInput('');
    setIme(EMPTY_IME);
    setLineStates({});
    setStats({ typed: 0, mistakes: 0, startedAt: 0 });
    setFinished(false);
    prevWrongRef.current = 0;
    setTtsError(undefined);
    rollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const advanceLine = useCallback((outcome: 'done' | 'skipped') => {
    const current = sentences[activeIndex];
    if (!current) return;
    setLineStates(prev => ({ ...prev, [current.id]: outcome }));
    setRawInput('');
    setIme(EMPTY_IME);
    prevWrongRef.current = 0;
    if (activeIndex + 1 < sentences.length) setActiveIndex(activeIndex + 1);
    else setFinished(true);
  }, [activeIndex, sentences]);

  // Smooth typewriter vertical roll whenever the active sentence advances.
  useEffect(() => {
    if (!open || finished) return;
    const frame = window.requestAnimationFrame(() => {
      activeInputRef.current?.focus({ preventScroll: true });
      const container = rollRef.current;
      const activeEl = lineRefs.current.get(activeIndex);
      if (!container || !activeEl) return;
      const delta = activeEl.getBoundingClientRect().top - container.getBoundingClientRect().top;
      const focalOffset = Math.min(64, Math.round(container.clientHeight * 0.16));
      const targetTop = Math.max(0, container.scrollTop + delta - focalOffset);
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      container.scrollTo({ top: targetTop, behavior: reduced ? 'auto' : 'smooth' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex, finished, open, scope]);

  // Auto-advance after a short completion pulse once a sentence is fully matched.
  useEffect(() => {
    if (!open || finished || !evaluation?.isComplete) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => advanceLine('done'), reduced ? 40 : 220);
    return () => window.clearTimeout(timer);
  }, [evaluation?.isComplete, finished, open, advanceLine]);

  useEffect(() => {
    if (!open) stopGlobalAudio();
    return () => stopGlobalAudio();
  }, [open]);

  function recordCommittedEvaluation(nextValue: string, nextIme: ImeState) {
    if (!activeSentence || nextIme.isComposing) return;
    const nextEval = evaluateTyping(
      activeSentence.text, nextValue, nextIme, activeSentence.highlights,
    );
    if (nextEval.imePending) return;
    const addedErrors = Math.max(0, nextEval.wrongCount - prevWrongRef.current);
    prevWrongRef.current = nextEval.wrongCount;
    setStats(prev => ({
      typed: prev.typed + 1,
      mistakes: prev.mistakes + addedErrors,
      startedAt: prev.startedAt || Date.now(),
    }));
  }

  function handleInputChange(value: string, nativeComposing: boolean) {
    setRawInput(value);
    const nextIme = nativeComposing && !ime.isComposing
      ? {
          isComposing: true,
          compositionStart: rawInput.length,
          compositionText: value.slice(rawInput.length),
        }
      : ime;
    if (nextIme !== ime) setIme(nextIme);
    recordCommittedEvaluation(value, nextIme);
  }

  function handleImeEnd(value: string) {
    setIme(EMPTY_IME);
    setRawInput(value);
    recordCommittedEvaluation(value, EMPTY_IME);
  }

  function handleHint() {
    if (!activeSentence || finished) return;
    setIme(EMPTY_IME);
    setRawInput(nextHintPrefix(activeSentence.text, rawInput));
    focusInput();
  }

  function jumpToLine(index: number) {
    setFinished(false);
    setActiveIndex(index);
    setRawInput('');
    setIme(EMPTY_IME);
    prevWrongRef.current = 0;
  }

  function toggleDisplayMode() {
    setDisplayMode(mode => (mode === 'guided' ? 'recall' : 'guided'));
    focusInput();
  }

  const completedCount = sentences.filter(s => lineStates[s.id] === 'done').length;
  const progressPct = sentences.length
    ? Math.round(((finished ? sentences.length : activeIndex) / sentences.length) * 100)
    : 0;
  const accuracy = stats.typed > 0
    ? Math.max(0, Math.round(((stats.typed - stats.mistakes) / stats.typed) * 100))
    : 100;

  return {
    rollRef,
    activeInputRef,
    lineRefs,
    sentences,
    activeSentence,
    activeIndex,
    scope,
    displayMode,
    rawInput,
    ime,
    setIme,
    lineStates,
    evaluation,
    finished,
    ttsError,
    setTtsError,
    hasEnglishAndOther,
    hasAnswersAndOther,
    completedCount,
    progressPct,
    accuracy,
    focusInput,
    resetSession,
    advanceLine,
    handleInputChange,
    handleImeEnd,
    handleHint,
    jumpToLine,
    toggleDisplayMode,
  };
}

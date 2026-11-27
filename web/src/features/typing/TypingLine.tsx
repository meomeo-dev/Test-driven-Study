import { useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import { CheckCircle2, SkipForward } from 'lucide-react';
import { AudioControls } from '../../components/AudioControls';
import {
  buildRecallDisplay,
  type ImeState,
  type TypingEvaluation,
} from './engine';
import { languageBadgeLabel, type TypingSentence } from './extract';

export type LineStatus = 'upcoming' | 'active' | 'done' | 'skipped';
export type DisplayMode = 'guided' | 'recall';

type Props = {
  sentence: TypingSentence;
  index: number;
  status: LineStatus;
  displayMode: DisplayMode;
  rawInput: string;
  ime: ImeState;
  evaluation?: TypingEvaluation;
  inputRef?: (el: HTMLTextAreaElement | null) => void;
  lineRef: (el: HTMLDivElement | null) => void;
  onSelect: () => void;
  onChange: (value: string, nativeComposing: boolean) => void;
  onImeStart: (start: number) => void;
  onImeUpdate: (data: string) => void;
  onImeEnd: (value: string) => void;
  onHint: () => void;
  onCommitComplete: () => void;
  onTtsError: (message?: string) => void;
};

function SentenceAudio({
  sentence,
  onTtsError,
}: {
  sentence: TypingSentence;
  onTtsError: (message?: string) => void;
}) {
  if (!sentence.speech) return null;
  if (sentence.speech.kind === 'pinyin') {
    return (
      <AudioControls
        text={sentence.speech.text}
        pinyin={sentence.speech.pinyin}
        targetLabel={`句子发音：${sentence.roleLabel}`}
        onError={onTtsError}
      />
    );
  }
  return (
    <AudioControls
      text={sentence.speech.text}
      voice={sentence.speech.voice}
      speed={sentence.speech.speed}
      targetLabel={`句子发音：${sentence.roleLabel}`}
      onError={onTtsError}
    />
  );
}

function underlineState(evaluation: TypingEvaluation, ime: ImeState): string {
  if (evaluation.isComplete) return 'complete';
  if (ime.isComposing || evaluation.imePending) return 'composing';
  if (evaluation.hasError) return 'error';
  return 'idle';
}

function statusCue(evaluation: TypingEvaluation, ime: ImeState): string {
  if (evaluation.isComplete) return '输入完成，即将自动上滚至下一句…';
  if (ime.isComposing) return '输入法组词中，选词上屏后自动校验…';
  if (evaluation.imePending) return '检测到拼音字母，请选词上屏或切换中文输入法…';
  if (evaluation.hasError) return '存在拼写不一致，可退格修正或按 Tab 提示';
  return '在横线区域输入上方句子（Tab 获取下一词提示）';
}

export function TypingLine({
  sentence,
  index,
  status,
  displayMode,
  rawInput,
  ime,
  evaluation,
  inputRef,
  lineRef,
  onSelect,
  onChange,
  onImeStart,
  onImeUpdate,
  onImeEnd,
  onHint,
  onCommitComplete,
  onTtsError,
}: Props) {
  const localInputRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    if (status !== 'active') return;
    const el = localInputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [rawInput, status, sentence.id]);

  if (status !== 'active') {
    const preview = displayMode === 'recall' && status === 'upcoming'
      ? buildRecallDisplay(sentence.text, 0).join('')
      : sentence.text;
    return (
      <div
        ref={lineRef}
        className={`typing-line typing-line-${status}`}
        data-line-index={index}
        data-line-status={status}
      >
        <button
          type="button"
          className="typing-line-summary"
          onClick={onSelect}
          title={status === 'upcoming' ? '跳到此句练习' : '点击重新练习此句'}
        >
          <span className="typing-line-icon" aria-hidden="true">
            {status === 'done' ? <CheckCircle2 size={15} /> : status === 'skipped' ? <SkipForward size={15} /> : <span className="typing-dot" />}
          </span>
          <span className="typing-role-tag">{sentence.roleLabel}</span>
          <span className="typing-summary-text" lang={sentence.language === 'en' ? 'en' : 'zh-CN'}>
            {preview}
          </span>
        </button>
      </div>
    );
  }

  const evalResult = evaluation!;
  const recallChars = displayMode === 'recall'
    ? buildRecallDisplay(sentence.text, evalResult.matchedCount)
    : null;
  const fieldState = underlineState(evalResult, ime);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229 || ime.isComposing) return;
    if (event.key === 'Tab' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      onHint();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (evalResult.isComplete) onCommitComplete();
    }
  }

  return (
    <div
      ref={lineRef}
      className="typing-line typing-line-active"
      data-line-index={index}
      data-line-status="active"
      data-typing-state={fieldState}
    >
      <div className="typing-line-meta">
        <span className={`typing-role-tag role-${sentence.role}`}>{sentence.roleLabel}</span>
        <span className="typing-lang-tag">{languageBadgeLabel(sentence.language)}</span>
        <SentenceAudio sentence={sentence} onTtsError={onTtsError} />
        <span className="typing-char-progress">
          {evalResult.matchedCount} / {evalResult.cells.length}
        </span>
      </div>

      {sentence.hint && (
        <p className="typing-hint-line">{sentence.hint}</p>
      )}

      <div
        className="typing-prompt"
        lang={sentence.language === 'en' ? 'en' : 'zh-CN'}
        aria-label="目标句子"
      >
        {evalResult.cells.map((cell, charIdx) => {
          const displayChar = recallChars ? recallChars[charIdx]! : cell.char;
          const classes = ['typing-char', cell.state];
          if (cell.highlighted) classes.push('blank-answer');
          return (
            <span key={charIdx} className={classes.join(' ')} data-char-state={cell.state}>
              {displayChar}
            </span>
          );
        })}
        {evalResult.extraWrong && (
          <span className="typing-char wrong typing-extra" data-char-state="wrong">
            {evalResult.extraWrong}
          </span>
        )}
      </div>

      <div className={`typing-underline-box state-${fieldState}`} data-ime-state={fieldState}>
        <textarea
          ref={el => {
            localInputRef.current = el;
            inputRef?.(el);
          }}
          rows={1}
          className="typing-underline-input"
          value={rawInput}
          lang={sentence.language === 'en' ? 'en' : 'zh-CN'}
          aria-label={`打字练习输入：${sentence.roleLabel}`}
          placeholder={sentence.language === 'zh' ? '在此横线上输入中文句子…' : '在此横线上输入句子…'}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          autoComplete="off"
          onCompositionStart={event =>
            onImeStart(event.currentTarget.selectionStart ?? event.currentTarget.value.length)
          }
          onCompositionUpdate={event => onImeUpdate(event.data)}
          onCompositionEnd={event => onImeEnd(event.currentTarget.value)}
          onChange={event =>
            onChange(
              event.currentTarget.value,
              Boolean((event.nativeEvent as InputEvent).isComposing),
            )
          }
          onKeyDown={handleKeyDown}
        />
      </div>

      <p
        className={`typing-status-cue state-${fieldState}`}
        role="status"
        aria-live="polite"
      >
        {statusCue(evalResult, ime)}
      </p>
    </div>
  );
}

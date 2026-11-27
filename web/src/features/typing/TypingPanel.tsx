import { useId, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Grip,
  Keyboard,
  Lightbulb,
  Maximize2,
  RotateCcw,
  SkipForward,
  Sparkles,
  X,
} from 'lucide-react';
import type { Question } from '../../api/generated/types.gen';
import type { WindowControls } from '../assistant/useWindowGeometry';
import { TypingLine, type LineStatus } from './TypingLine';
import { EMPTY_IME, useTypingSession } from './useTypingSession';

export type TypingPanelProps = {
  question: Question;
  courseLanguage?: string;
  open: boolean;
  onOpen: (value: boolean) => void;
  windowControls: WindowControls;
  launcherClassName: string;
  launcherContent: ReactNode;
  onNextQuestion?: () => void;
};

export default function TypingPanel({
  question,
  courseLanguage,
  open,
  onOpen,
  windowControls,
  launcherClassName,
  launcherContent,
  onNextQuestion,
}: TypingPanelProps) {
  const descriptionID = useId();
  const s = useTypingSession(question, courseLanguage, open);

  return (
    <Dialog.Root open={open} onOpenChange={onOpen} modal={false}>
      <Dialog.Trigger className={launcherClassName} aria-label="打开打字学习浮窗">
        {launcherContent}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Content
          className="typing-panel"
          style={{
            left: windowControls.geometry.x,
            top: windowControls.geometry.y,
            width: windowControls.geometry.width,
            height: windowControls.geometry.height,
          }}
          aria-describedby={descriptionID}
          onOpenAutoFocus={event => {
            event.preventDefault();
            s.focusInput();
          }}
          onInteractOutside={event => event.preventDefault()}
          {...windowControls.pointer}
        >
          <header
            className="typing-heading"
            tabIndex={0}
            role="group"
            aria-label="移动打字学习窗口"
            title="拖动标题栏移动，方向键微调，Shift 加方向键精调"
            onKeyDown={windowControls.moveKeys}
            onPointerDown={event => {
              if (!(event.target as Element).closest('button')) windowControls.startMove(event);
            }}
          >
            <div>
              <Dialog.Title asChild>
                <h2>
                  <Keyboard size={16} aria-hidden="true" /> 打字学习 <span>逐句练习</span>
                </h2>
              </Dialog.Title>
            </div>
            <button type="button" className="icon-button" onClick={() => s.resetSession()}
              aria-label="重新开始本轮打字" title="重新开始本轮打字">
              <RotateCcw size={15} />
            </button>
            <button type="button" className="icon-button" onClick={windowControls.reset}
              aria-label="恢复默认窗口" title="恢复默认窗口">
              <Maximize2 size={15} />
            </button>
            <button type="button" className="icon-button" onClick={() => onOpen(false)}
              aria-label="关闭打字学习">
              <X size={19} />
            </button>
          </header>

          <div className="typing-context" id={descriptionID}>
            <div className="typing-context-row">
              <span>题目 <b>#{question.source_item_id ?? question.question_id}</b></span>
              <span className="typing-progress-meta" data-testid="typing-progress">
                第 {Math.min(s.activeIndex + 1, s.sentences.length)} / {s.sentences.length} 句 · 正确率 {s.accuracy}%
              </span>
            </div>
            <div className="typing-progress-track" role="progressbar" aria-label="打字学习进度"
              aria-valuemin={0} aria-valuemax={Math.max(1, s.sentences.length)}
              aria-valuenow={s.completedCount}>
              <div style={{ width: `${s.progressPct}%` }} />
            </div>
            <div className="typing-controls-bar">
              <div className="typing-pills" role="group" aria-label="练习范围">
                <button type="button" aria-pressed={s.scope === 'all'}
                  onClick={() => s.resetSession('all')}>
                  全部（题+答）
                </button>
                {s.hasEnglishAndOther && (
                  <button type="button" aria-pressed={s.scope === 'english'}
                    onClick={() => s.resetSession('english')}>
                    仅英文
                  </button>
                )}
                {s.hasAnswersAndOther && (
                  <button type="button" aria-pressed={s.scope === 'answers'}
                    onClick={() => s.resetSession('answers')}>
                    仅答案
                  </button>
                )}
              </div>
              <button type="button" className="typing-mode-toggle"
                aria-pressed={s.displayMode === 'recall'} onClick={s.toggleDisplayMode}
                title="切换跟打原文或默写提示模式">
                {s.displayMode === 'recall' ? <EyeOff size={13} /> : <Eye size={13} />}
                <span>{s.displayMode === 'recall' ? '默写提示' : '跟打原文'}</span>
              </button>
            </div>
          </div>

          {s.ttsError && (
            <div className="typing-tts-error" role="alert">
              <span>{s.ttsError}</span>
              <button type="button" className="icon-button" aria-label="关闭语音提示"
                onClick={() => s.setTtsError(undefined)}>
                <X size={13} />
              </button>
            </div>
          )}

          <div ref={s.rollRef} className="typing-roll" data-testid="typing-roll">
            {s.sentences.length === 0 ? (
              <p className="typing-empty">本题暂无可供打字练习的文本内容。</p>
            ) : (
              s.sentences.map((sentence, idx) => {
                const status: LineStatus = !s.finished && idx === s.activeIndex
                  ? 'active'
                  : s.lineStates[sentence.id] ?? (idx < s.activeIndex ? 'done' : 'upcoming');
                return (
                  <TypingLine
                    key={sentence.id}
                    sentence={sentence}
                    index={idx}
                    status={status}
                    displayMode={s.displayMode}
                    rawInput={status === 'active' ? s.rawInput : ''}
                    ime={status === 'active' ? s.ime : EMPTY_IME}
                    evaluation={status === 'active' ? s.evaluation : undefined}
                    inputRef={status === 'active' ? el => { s.activeInputRef.current = el; } : undefined}
                    lineRef={el => {
                      if (el) s.lineRefs.current.set(idx, el);
                      else s.lineRefs.current.delete(idx);
                    }}
                    onSelect={() => s.jumpToLine(idx)}
                    onChange={s.handleInputChange}
                    onImeStart={start => s.setIme({
                      isComposing: true, compositionStart: start, compositionText: '',
                    })}
                    onImeUpdate={data => s.setIme(prev => ({
                      ...prev, isComposing: true, compositionText: data,
                    }))}
                    onImeEnd={s.handleImeEnd}
                    onHint={s.handleHint}
                    onCommitComplete={() => s.advanceLine('done')}
                    onTtsError={s.setTtsError}
                  />
                );
              })
            )}

            {s.finished && s.sentences.length > 0 && (
              <section className="typing-complete-card" aria-label="本轮打字完成"
                data-testid="typing-complete">
                <div className="typing-complete-title">
                  <Sparkles size={18} aria-hidden="true" />
                  <h3>本题打字练习完成</h3>
                </div>
                <p>
                  已完成 {s.completedCount} / {s.sentences.length} 句，正确率 <b>{s.accuracy}%</b>。
                </p>
                <div className="typing-complete-actions">
                  <button type="button" className="button outline" onClick={() => s.resetSession()}>
                    <RotateCcw size={14} />再练一遍
                  </button>
                  {onNextQuestion && (
                    <button type="button" className="button primary" onClick={onNextQuestion}>
                      下一题<ChevronRight size={15} />
                    </button>
                  )}
                </div>
              </section>
            )}
          </div>

          <footer className="typing-footer">
            <button type="button" className="typing-foot-btn"
              disabled={s.finished || !s.activeSentence} onClick={s.handleHint}>
              <Lightbulb size={14} /><span>提示</span><kbd aria-hidden="true">Tab</kbd>
            </button>
            <button type="button" className="typing-foot-btn"
              disabled={s.finished || !s.activeSentence} onClick={() => s.advanceLine('skipped')}>
              <SkipForward size={14} /><span>跳过本句</span>
            </button>
            <button type="button" className="typing-foot-btn"
              disabled={s.activeIndex <= 0 && !s.finished}
              onClick={() => s.jumpToLine(s.finished ? Math.max(0, s.sentences.length - 1) : s.activeIndex - 1)}>
              <ChevronLeft size={14} /><span>上一句</span>
            </button>
            {onNextQuestion && (
              <button type="button" className="typing-foot-btn typing-next-q" onClick={onNextQuestion}>
                <span>下一题</span><ChevronRight size={14} />
              </button>
            )}
          </footer>

          <button type="button" className="typing-resize-handle"
            aria-label="调整打字学习窗口大小"
            title="拖动调整大小，方向键微调，Shift 加方向键精调"
            onPointerDown={windowControls.startResize} onKeyDown={windowControls.resizeKeys}>
            <Grip size={13} />
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

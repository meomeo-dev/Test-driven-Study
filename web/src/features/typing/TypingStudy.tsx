import { lazy, Suspense, useEffect, useState } from 'react';
import { Keyboard } from 'lucide-react';
import type { Question } from '../../api/generated/types.gen';
import { useWindowGeometry } from '../assistant/useWindowGeometry';
import './typing.css';

const TypingPanel = lazy(() => import('./TypingPanel'));

const TYPING_WINDOW_OPTIONS = {
  storageKey: 'test-driven-study.typing-window',
  width: 560,
  height: 580,
  rightOffset: 24,
} as const;

export function TypingStudy({
  question,
  courseLanguage,
  compact = false,
  disabled = false,
  disabledTitle,
  onNextQuestion,
}: {
  question?: Question;
  courseLanguage?: string;
  compact?: boolean;
  disabled?: boolean;
  disabledTitle?: string;
  onNextQuestion?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [activated, setActivated] = useState(false);
  const windowControls = useWindowGeometry(TYPING_WINDOW_OPTIONS);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const launcherClassName = compact ? 'button text typing-launcher-inline' : 'typing-launcher';
  const launcherContent = compact ? (
    <>
      <Keyboard size={16} aria-hidden="true" />
      <span>打字学习</span>
    </>
  ) : (
    <>
      <Keyboard size={24} aria-hidden="true" />
      <span className="typing-launcher-badge">打字</span>
      <span className="typing-launcher-label">打字学习</span>
    </>
  );

  if (!question || disabled) {
    if (!compact) return null;
    return (
      <button
        type="button"
        className={launcherClassName}
        aria-label="打字学习"
        title={disabledTitle ?? '提交作答后可进行打字学习'}
        disabled
      >
        {launcherContent}
      </button>
    );
  }

  const launcher = (
    <button
      type="button"
      className={launcherClassName}
      aria-label="打开打字学习浮窗"
      aria-busy={activated}
      disabled={activated}
      onClick={() => {
        setActivated(true);
        setOpen(true);
      }}
    >
      {launcherContent}
    </button>
  );

  if (!activated) return launcher;

  return (
    <Suspense fallback={launcher}>
      <TypingPanel
        key={question.question_id}
        question={question}
        courseLanguage={courseLanguage}
        open={open}
        onOpen={setOpen}
        windowControls={windowControls}
        launcherClassName={launcherClassName}
        launcherContent={launcherContent}
        onNextQuestion={onNextQuestion}
      />
    </Suspense>
  );
}

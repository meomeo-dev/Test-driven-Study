import { lazy, Suspense, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { useWindowGeometry } from './useWindowGeometry';
import './assistant.css';

const QuestionConversation = lazy(() => import('./QuestionConversation'));

export function QuestionAssistant({ questionID, compact = false }: {
  questionID: number; compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [activated, setActivated] = useState(false);
  const windowControls = useWindowGeometry();
  function changeOpen(value: boolean) {
    if (value) windowControls.fillHeight();
    setOpen(value);
  }
  if (!questionID) return null;
  const launcherClassName = compact ? 'button text tutor-launcher-inline' : 'tutor-launcher';
  const launcherContent = compact ? <>
    <MessageCircle size={16} aria-hidden="true" /><span>问问本题</span>
  </> : <>
    <MessageCircle size={24} aria-hidden="true" /><span className="tutor-launcher-ai">AI</span>
    <span className="tutor-launcher-label">问问本题</span>
  </>;
  const launcher = <button className={launcherClassName} aria-label="询问本题 · 学习助手"
    aria-busy={activated} disabled={activated}
    onClick={() => { setActivated(true); changeOpen(true); }}>
    {launcherContent}
  </button>;
  if (!activated) return launcher;
  return <Suspense fallback={launcher}>
    <QuestionConversation key={questionID} questionID={questionID}
      open={open} onOpen={changeOpen}
      windowControls={windowControls}
      launcherClassName={launcherClassName} launcherContent={launcherContent} />
  </Suspense>;
}

import type { ReactNode } from 'react';
import { FileText, Keyboard } from 'lucide-react';
import type { Overview } from '../../api/client';
import { ThemeToggle } from '../../components/ThemeToggle';

type Props = {
  overview?: Overview;
  shortcuts: boolean;
  navigation: ReactNode;
  vocabulary: ReactNode;
  assistant?: ReactNode;
  typing?: ReactNode;
  onHelp: (trigger: HTMLButtonElement) => void;
  onAnalysis: (trigger: HTMLButtonElement) => void;
};
export function PageHeader({
  overview, shortcuts, navigation, vocabulary, assistant, typing, onHelp, onAnalysis,
}: Props) {
  return <header className="workspace-toolbar">
    <h1 className="sr-only">背题模式</h1>
    <section className="progress-strip" aria-label="科目学习进度">
      <span>已记住 <b data-testid="mastered-count">{overview?.mastered ?? 0}</b>
        <span className="muted"> / {overview?.total ?? '—'}</span></span>
      <div className="progress-track" role="progressbar" aria-label="已记住进度"
        aria-valuemin={0} aria-valuemax={overview?.total ?? 1}
        aria-valuenow={overview?.mastered ?? 0}>
        <div style={{ width: `${overview?.total ? overview.mastered / overview.total * 100 : 0}%` }} />
      </div>
      <span className="review-count">待复习 <b data-testid="review-count">{overview?.review ?? 0}</b></span>
    </section>
    <div className="workspace-tools">
      <ThemeToggle />
      {navigation}
      {vocabulary}
      {assistant}
      {typing}
      <button type="button" className="button text analysis-trigger"
        aria-label="查看解析" onClick={event => onAnalysis(event.currentTarget)}>
        <FileText size={16} /><span>解析</span>
      </button>
      <button type="button" className="button text help-trigger"
        onClick={event => onHelp(event.currentTarget)}
        aria-label="快捷键" aria-keyshortcuts={shortcuts ? '?' : undefined}>
        <Keyboard size={17} /><span>快捷键</span>
        {shortcuts && <kbd aria-hidden="true">?</kbd>}
      </button>
    </div>
  </header>;
}

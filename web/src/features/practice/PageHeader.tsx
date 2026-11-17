import type { ReactNode } from 'react';
import { FileText, Keyboard } from 'lucide-react';
import type { Overview } from '../../api/practice';
import { ThemeToggle } from '../../components/ThemeToggle';
import { QuestionAssistant } from '../assistant/QuestionAssistant';

type Props = {
  overview?: Overview;
  questionID: number;
  shortcuts: boolean;
  analysisAvailable: boolean;
  navigation: ReactNode;
  onHelp: (trigger: HTMLButtonElement) => void;
  onAnalysis: (trigger: HTMLButtonElement) => void;
};
export function PageHeader({ overview, questionID, shortcuts, navigation, onHelp, onAnalysis, analysisAvailable }: Props) {
  return <header className="workspace-toolbar">
    <h1 className="sr-only">答题模式</h1>
    <section className="progress-strip" aria-label="科目学习进度">
      <span><span className="progress-label">最近答对 </span><b data-testid="practice-correct-count">{overview?.correct ?? 0}</b>
        <span className="muted"> / {overview?.total ?? '—'}</span></span>
      <div className="progress-track" role="progressbar" aria-label="最近答对进度"
        aria-valuemin={0} aria-valuemax={overview?.total ?? 1}
        aria-valuenow={overview?.correct ?? 0}>
        <div style={{ width: `${overview?.total ? overview.correct / overview.total * 100 : 0}%` }} />
      </div>
      <span className="review-count">最近答错 <b data-testid="practice-incorrect-count">{overview?.incorrect ?? 0}</b></span>
    </section>
    <div className="workspace-tools">
      <ThemeToggle />
      {navigation}
      <QuestionAssistant questionID={questionID} compact />
      <button type="button" className="button text analysis-trigger"
        aria-label="查看解析" disabled={!analysisAvailable} onClick={event => onAnalysis(event.currentTarget)}>
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

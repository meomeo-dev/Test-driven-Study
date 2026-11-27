import { readSubject, useWorkspace } from '../../app/workspace';
import { useConversationCoverage } from '../assistant/useConversationCoverage';
import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { Map, RotateCcw } from 'lucide-react';
import * as api from '../../api/palace';
import { detail, overview, questions } from '../../api/client';
import { Sidebar } from '../../components/Sidebar';
import { ThemeToggle } from '../../components/ThemeToggle';
import { QuestionNavigation } from '../question-navigation';
import { activeQuestion, navigationStatus } from '../memorization/model';
import { useMemorizationExposure } from '../memorization/hooks';
import { PalaceWorkspace } from './PalaceWorkspace';
import { ProviderDialog } from './ProviderDialog';
import { TaskManager } from './TaskManager';
import { usePalaceCoverage } from './hooks';

import { QuestionAssistant } from '../assistant/QuestionAssistant';
import { TypingStudy } from '../typing/TypingStudy';

export function PalacePage() {
  const [params, setParams] = useSearchParams();
  const subject = readSubject(params);
  const { course } = useWorkspace(subject);
  const navigation = useRef<HTMLButtonElement>(null);
  const info = useQuery({ queryKey: ['palace-info'], queryFn: ({ signal }) => api.info(signal) });
  const list = useQuery({ queryKey: ['palace-questions', subject],
    queryFn: ({ signal }) => questions({ subject, chapter: '', state: 'all', search: '' }, signal) });
  const summary = useQuery({ queryKey: ['overview', subject], queryFn: ({ signal }) => overview(subject, signal) });
  const rows = list.data ?? [];
  const savedImages = usePalaceCoverage(subject);
  const conversations = useConversationCoverage(subject);
  const id = activeQuestion(rows, params.get('question'), summary.data?.last_question_id ?? 0);
  const question = useQuery({ queryKey: ['question', id], enabled: id > 0,
    queryFn: ({ signal }) => detail(id, signal) });
  const history = useQuery({ queryKey: ['palace-history', subject], queryFn: ({ signal }) => api.history(subject, signal),
    refetchInterval: query => query.state.data?.some(api.active) ? 2500 : 10_000 });
  useMemorizationExposure(question.data?.question.question_id === id ? id : 0);
  function go(target: number, job?: string) {
    setParams({ subject: String(subject), question: String(target), ...(job ? { job } : {}) });
  }
  const error = list.error || summary.error || question.error || info.error || history.error;
  return <div className="app-shell palace-shell">
    <a href="#palace-main" className="skip-link">跳到记忆宫殿</a>
    <Sidebar mode="palace" subject={subject} question={id}
      onSubject={subject => setParams({ subject: String(subject) })} />
    <main id="palace-main" className="workspace palace-workspace">
      <header className="palace-toolbar"><h1><Map size={20} />记忆宫殿</h1>
        <span className="palace-subtitle">一题一画面，记住关键规则</span>
        <div className="palace-action-spacer" /><TaskManager subject={subject} /><ProviderDialog /><ThemeToggle />
        <QuestionAssistant questionID={id} compact />
        <TypingStudy question={question.data?.question} courseLanguage={course?.language} compact />
        <QuestionNavigation rows={rows} current={id} status={navigationStatus}
          shortcuts={false} triggerRef={navigation}
          palaces={savedImages.marked} conversations={conversations}
          onSelect={id => go(id, savedImages.entries.get(id)?.latest_job_id)} />
      </header>
      {error ? <div className="page-state" role="alert"><h2>暂时无法读取记忆宫殿</h2><p>{error.message}</p>
        <button className="button outline" onClick={() => {
          void list.refetch(); void summary.refetch(); void question.refetch(); void info.refetch(); void history.refetch();
        }}><RotateCcw size={15} />重新读取</button></div>
        : question.data && info.data ? <PalaceWorkspace key={id} detail={question.data} info={info.data}
          jobs={history.data ?? []} selected={params.get('job') || savedImages.entries.get(id)?.latest_job_id}
          onJobID={job => go(id, job)} onSelect={job => go(job.question_id, job.id)} />
          : <div className="page-state" role="status">正在读取题库与生图配置…</div>}
    </main>
  </div>;
}

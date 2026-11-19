import { useConversationCoverage } from '../assistant/useConversationCoverage';
import { usePalaceCoverage } from '../palace/hooks';
import { QuestionAssistant } from '../assistant/QuestionAssistant';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { AlertCircle, BookOpen, LoaderCircle, RotateCcw } from 'lucide-react';
import type { ProgressState } from '../../api/client';
import { Sidebar } from '../../components/Sidebar';
import { QuestionNavigation } from '../question-navigation';
import { PageHeader } from './PageHeader';
import { Filters } from './Filters';
import { QuestionCard } from './QuestionCard';
import { StudyDetails, type DetailsTab } from './StudyDetails';
import { KeyboardHelp } from './KeyboardHelp';
import { activeQuestion, navigationStatus, nearbyQuestion, readFilters } from './model';
import { useMemorizationExposure, useProgressMutation, useQuestionQuery, useSavedCursor, useStudyQueries } from './hooks';
import { useShortcutPreference, useStudyShortcuts } from './useStudyShortcuts';

export function MemorizationPage() {
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const palaceImages = usePalaceCoverage(filters.subject);
  const conversations = useConversationCoverage(filters.subject);
  const [notice, setNotice] = useState('');
  const [detailsTab, setDetailsTab] = useState<DetailsTab | null>(null);
  const [help, setHelp] = useState(false);
  const shortcuts = useShortcutPreference();
  const reading = useRef<HTMLElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const image = useRef<HTMLButtonElement>(null);
  const detailsFocus = useRef<HTMLElement | null>(null);
  const navigation = useRef<HTMLButtonElement>(null);
  const helpFocus = useRef<HTMLElement | null>(null);
  const { overview, list } = useStudyQueries(filters);
  const rows = list.data ?? [];
  const ready = !!overview.data && !!list.data;
  const id = ready ? activeQuestion(rows, params.get('question'), overview.data.last_question_id) : 0;
  const question = useQuestionQuery(id);
  const mutation = useProgressMutation(filters.subject);
  useMemorizationExposure(question.data?.question.question_id === id ? id : 0);
  const position = rows.findIndex(row => row.question_id === id) + 1;
  const canAct = !!question.data && question.data.question.question_id === id && !mutation.isPending;
  const go = useCallback((target: number) => {
    setParams(current => { const next = new URLSearchParams(current);
      next.set('question', String(target)); return next; });
  }, [setParams]);
  const changeFilter = useCallback((key: string, value: string) => {
    setParams(current => { const next = new URLSearchParams(current);
      next.delete('question'); if (value) next.set(key, value); else next.delete(key); return next; });
  }, [setParams]);
  const previous = () => { const target = nearbyQuestion(rows, id, -1); if (target && !mutation.isPending) go(target); };
  const next = () => { const target = nearbyQuestion(rows, id, 1); if (target && !mutation.isPending) go(target); };
  function currentFocus() {
    const active = document.activeElement;
    return active instanceof HTMLElement && active !== document.body
      ? active : reading.current;
  }
  function openDetails(tab: DetailsTab, trigger?: HTMLElement) {
    if (!question.data) return;
    detailsFocus.current = trigger ?? currentFocus();
    setDetailsTab(tab);
  }
  function openHelp(trigger?: HTMLElement) {
    helpFocus.current = trigger ?? currentFocus();
    setHelp(true);
  }
  useSavedCursor(filters.subject, id, setNotice);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function mark(state: ProgressState, advance = false) {
    if (!canAct) return;
    const nextId = nearbyQuestion(rows, id, 1);
    const excluded = filters.state !== 'all' && filters.state !== state;
    const target = nextId ?? (excluded ? nearbyQuestion(rows, id, -1) : undefined);
    try {
      await mutation.mutateAsync({ id, state });
      if ((advance || excluded) && target) go(target);
      setNotice(state === 'mastered' ? '已记住，进度已保存。'
        : state === 'review' ? '已加入待复习。' : '已撤销当前标记。');
    } catch (error) { setNotice(error instanceof Error ? error.message : '保存失败，请重试。'); }
  }
  useStudyShortcuts(shortcuts.enabled, {
    next, previous,
    first: () => { if (rows[0] && !mutation.isPending) go(rows[0].question_id); },
    last: () => { const row = rows.at(-1); if (row && !mutation.isPending) go(row.question_id); },
    search: () => { search.current?.focus(); search.current?.select(); },
    master: () => { void mark('mastered', true); },
    review: () => { void mark(question.data?.state === 'review' ? 'unlearned' : 'review'); },
    clear: () => { if (question.data?.state !== 'unlearned') void mark('unlearned'); },
    image: () => image.current?.click(), details: () => openDetails('question'),
    navigation: () => navigation.current?.click(), help: openHelp,
  });
  const error = overview.error ?? list.error ?? question.error;
  return <div className="app-shell">
    <a href="#study-main" className="skip-link">跳到题目内容</a>
    <Sidebar subject={filters.subject} question={id} onSubject={subject => setParams({ subject: String(subject) })} />
    <main id="study-main" className="workspace">
      <PageHeader overview={overview.data} shortcuts={shortcuts.enabled}
        onHelp={openHelp} onAnalysis={trigger => openDetails('analysis', trigger)}
        navigation={<QuestionNavigation rows={rows} current={id} status={navigationStatus}
          palaces={palaceImages.marked} conversations={conversations} onSelect={go}
          shortcuts={shortcuts.enabled} triggerRef={navigation} />} />
      <div className="study-layout">
        <section ref={reading} tabIndex={-1} className="reading-panel" aria-label="背题阅读区">
          <Filters filters={filters} chapters={overview.data?.chapters ?? []} onChange={changeFilter}
            shortcuts={shortcuts.enabled} searchRef={search} onSearchExit={() => reading.current?.focus()} />
          {error ? <div className="page-state" role="alert"><AlertCircle size={26} /><h2>暂时无法读取题目</h2><p>{error.message}</p>
            <button className="button outline" onClick={() => { void overview.refetch(); void list.refetch(); if (id) void question.refetch(); }}>
              <RotateCcw size={15} />重新读取</button></div>
            : !ready ? <div className="page-state" role="status"><LoaderCircle className="spin" size={26} /><p>正在读取题库…</p></div>
            : rows.length === 0 ? <div className="page-state"><BookOpen size={28} /><h2>没有符合条件的题目</h2>
              <p>请调整关键词、章节或学习状态。</p><button className="button outline" onClick={() => setParams({ subject: String(filters.subject) })}>重置筛选</button></div>
            : question.data ? <QuestionCard detail={question.data} position={position} total={rows.length}
              pending={!canAct} shortcuts={shortcuts.enabled} imageRef={image}
              onPrevious={previous} onNext={next} onMark={mark} onDetails={openDetails} />
            : <div className="page-state" role="status"><LoaderCircle className="spin" size={26} /><p>正在加载题目…</p></div>}
        </section>
      </div>
      <div className={`save-notice ${notice ? 'visible' : ''}`} role="status" aria-live="polite">{notice}</div>
      <StudyDetails detail={question.data} tab={detailsTab} onTab={setDetailsTab} returnFocus={detailsFocus} />
      <KeyboardHelp open={help} onOpenChange={setHelp} enabled={shortcuts.enabled}
        onEnabled={shortcuts.change} returnFocus={helpFocus} />
    </main>
    <QuestionAssistant questionID={id} />
  </div>;
}

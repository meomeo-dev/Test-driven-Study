import { useConversationCoverage } from '../assistant/useConversationCoverage';
import { usePalaceCoverage } from '../palace/hooks';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AlertCircle, BookOpen, LoaderCircle, RotateCcw } from 'lucide-react';
import type { Summary, AttemptResult } from '../../api/practice';
import { Sidebar } from '../../components/Sidebar';
import { QuestionNavigation } from '../question-navigation';
import { PageHeader } from './PageHeader';
import { Filters } from './Filters';
import { PracticeSession, type SessionCommands } from './PracticeSession';
import { KeyboardHelp } from './KeyboardHelp';
import { activeQuestion, navigationStatus, nearbyQuestion, readFilters } from './model';
import { useSavedCursor, useStudyQueries } from './hooks';
import { useShortcutPreference, useStudyShortcuts } from './useStudyShortcuts';
import { useWorkspace } from '../../app/workspace';
import { useConceptGraph } from '../learning/hooks';

export function PracticePage() {
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const palaceImages = usePalaceCoverage(filters.subject);
  const conversations = useConversationCoverage(filters.subject);
  const [notice, setNotice] = useState('');
  const [hasResult, setHasResult] = useState(false);
  const [heldRows, setHeldRows] = useState<Summary[] | null>(null);
  const [help, setHelp] = useState(false);
  const shortcuts = useShortcutPreference();
  const reading = useRef<HTMLElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const session = useRef<SessionCommands>(null);
  const pending = useRef(false);
  const onPending = useCallback((value: boolean) => { pending.current = value; }, []);
  const navigation = useRef<HTMLButtonElement>(null);
  const helpFocus = useRef<HTMLElement | null>(null);
  const { overview, list } = useStudyQueries(filters);
  const { course } = useWorkspace(filters.subject);
  const concepts = useConceptGraph(filters.concept ? course?.id : undefined);
  const conceptTitle = concepts.data?.concepts.find(value => value.id === filters.concept)?.title;
  const rows = heldRows ?? list.data ?? [];
  const reviewing = filters.state === 'review';
  const ready = !!overview.data && !!list.data && (!reviewing || list.isFetchedAfterMount);
  const id = ready ? activeQuestion(rows, params.get('question'), overview.data.last_question_id) : 0;
  const position = rows.findIndex(row => row.question_id === id) + 1;
  const go = useCallback((target: number) => {
    if (pending.current) return;
    setHeldRows(null);
    setParams(current => { const next = new URLSearchParams(current);
      next.set('question', String(target)); return next; });
  }, [setParams]);
  const changeFilter = useCallback((key: string, value: string) => {
    if (pending.current) return;
    setHeldRows(null);
    setParams(current => { const next = new URLSearchParams(current);
      next.delete('question'); if (value) next.set(key, value); else next.delete(key); return next; });
  }, [setParams]);
  const previous = () => { const target = nearbyQuestion(rows, id, -1); if (target && !pending.current) go(target); };
  const next = () => { const target = nearbyQuestion(rows, id, 1); if (target && !pending.current) go(target); };
  function currentFocus() {
    const active = document.activeElement;
    return active instanceof HTMLElement && active !== document.body
      ? active : reading.current;
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

  function saved(result: AttemptResult) {
    // Keep this question visible while showing feedback, even if the updated
    // unanswered/wrong filter would otherwise remove it immediately.
    setHeldRows(rows.map(row => row.question_id === result.attempt.question_id
      ? { ...row, state: result.attempt.correct ? 'correct' as const : 'incorrect' as const } : row));
  }
  useStudyShortcuts(shortcuts.enabled, {
    next, previous,
    first: () => { if (rows[0] && !pending.current) go(rows[0].question_id); },
    last: () => { const row = rows.at(-1); if (row && !pending.current) go(row.question_id); },
    search: () => { search.current?.focus(); search.current?.select(); },
    choose1: () => session.current?.choose(1), choose2: () => session.current?.choose(2),
    choose3: () => session.current?.choose(3), choose4: () => session.current?.choose(4),
    confirm: () => session.current?.confirm(), retry: () => session.current?.retry(),
    image: () => session.current?.image(), details: () => session.current?.details(),
    navigation: () => navigation.current?.click(), help: openHelp,
  });
  const error = overview.error ?? list.error;
  return <div className="app-shell practice-shell">
    <a href="#study-main" className="skip-link">跳到题目内容</a>
    <Sidebar mode="practice" subject={filters.subject} question={id} onSubject={subject => {
      if (!pending.current) { setHeldRows(null); setParams({ subject: String(subject) }); }
    }} />
    <main id="study-main" className="workspace">
      <PageHeader overview={overview.data} questionID={id} shortcuts={shortcuts.enabled} analysisAvailable={hasResult}
        onHelp={openHelp} onAnalysis={trigger => session.current?.analysis(trigger)}
        navigation={<QuestionNavigation rows={rows} current={id} status={navigationStatus}
          palaces={palaceImages.marked} conversations={conversations} onSelect={go}
          shortcuts={shortcuts.enabled} triggerRef={navigation} />} />
      <div className="study-layout">
        <section ref={reading} tabIndex={-1} className="reading-panel" aria-label="答题阅读区">
          {reviewing && <div className="practice-review-context">
            <span>错题本 · 按易错分复习</span>
            <Link className="inline-action" to={`/analysis?subject=${filters.subject}&tab=review`}>
              返回错题本
            </Link>
          </div>}
          <Filters filters={filters} chapters={overview.data?.chapters ?? []} onChange={changeFilter}
            conceptTitle={conceptTitle}
            shortcuts={shortcuts.enabled} searchRef={search} onSearchExit={() => reading.current?.focus()} />
          {error ? <div className="page-state" role="alert"><AlertCircle size={26} /><h2>暂时无法读取题目</h2><p>{error.message}</p>
            <button className="button outline" onClick={() => { void overview.refetch(); void list.refetch(); }}>
              <RotateCcw size={15} />重新读取</button></div>
            : !ready ? <div className="page-state" role="status"><LoaderCircle className="spin" size={26} /><p>正在读取题库…</p></div>
            : rows.length === 0 ? <div className="page-state"><BookOpen size={28} /><h2>没有符合条件的题目</h2>
              <p>请调整关键词、章节或学习状态。</p><button className="button outline" onClick={() => setParams({ subject: String(filters.subject) })}>重置筛选</button></div>
            : <PracticeSession key={id} id={id} position={position} total={rows.length}
              shortcuts={shortcuts.enabled} commands={session} onPending={onPending} onRevealed={setHasResult}
              onPrevious={previous} onNext={next} onResult={saved} />}
        </section>
      </div>
      <div className={`save-notice ${notice ? 'visible' : ''}`} role="status" aria-live="polite">{notice}</div>
      <KeyboardHelp open={help} onOpenChange={setHelp} enabled={shortcuts.enabled}
        onEnabled={shortcuts.change} returnFocus={helpFocus} />
    </main>
  </div>;
}

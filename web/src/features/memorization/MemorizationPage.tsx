import { useConversationCoverage } from '../assistant/useConversationCoverage';
import { usePalaceCoverage } from '../palace/hooks';
import { QuestionAssistant } from '../assistant/QuestionAssistant';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { AlertCircle, BookOpen, LoaderCircle, RotateCcw } from 'lucide-react';
import type { ProgressState } from '../../api/client';
import { Sidebar } from '../../components/Sidebar';
import { QuestionNavigation } from '../question-navigation';
import { VocabularyNotebook } from '../vocabulary/VocabularyNotebook';
import { PageHeader } from './PageHeader';
import { Filters } from './Filters';
import { QuestionCard } from './QuestionCard';
import { StudyDetails, type DetailsTab } from './StudyDetails';
import { KeyboardHelp } from './KeyboardHelp';
import { activeQuestion, navigationStatus, nearbyQuestion, readFilters } from './model';
import {
  useMemorizationExposure, useProgressMutation, useQuestionQuery,
  useSavedCursor, useStudyQueries,
} from './hooks';

type FilteredAdvance = { location: string; from: number; to: number };
import { useShortcutPreference, useStudyShortcuts } from './useStudyShortcuts';

export function MemorizationPage() {
  const [params, setParams] = useSearchParams();
  const { key: locationKey } = useLocation();
  const filters = readFilters(params);
  const palaceImages = usePalaceCoverage(filters.subject);
  const conversations = useConversationCoverage(filters.subject);
  const [notice, setNotice] = useState('');
  const [detailsTab, setDetailsTab] = useState<DetailsTab | null>(null);
  const [showStudyTranslation, setShowStudyTranslation] = useState(true);
  const [help, setHelp] = useState(false);
  const [filteredAdvance, setFilteredAdvance] = useState<FilteredAdvance>();
  const activeLocation = useRef(locationKey);
  const marking = useRef(false);
  const shortcuts = useShortcutPreference();
  const reading = useRef<HTMLElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const image = useRef<HTMLButtonElement>(null);
  const detailsFocus = useRef<HTMLElement | null>(null);
  const navigation = useRef<HTMLButtonElement>(null);
  const helpFocus = useRef<HTMLElement | null>(null);
  const study = useStudyQueries(filters);
  const overview = study.data?.overview;
  const rows = study.data?.rows ?? [];
  const ready = Boolean(study.data && !study.isPlaceholderData);
  const advance = filteredAdvance?.location === locationKey ? filteredAdvance : undefined;
  // A refreshed filter can remove the marked row before the URL advances.
  const selection = advance && !rows.some(row => row.question_id === advance.from)
    ? String(advance.to) : params.get('question');
  const id = ready && overview ? activeQuestion(rows, selection, overview.last_question_id) : 0;
  const question = useQuestionQuery(id);
  const position = id ? rows.findIndex(row =>
    row.question_id === question.data?.question.question_id) + 1 : 0;
  const row = rows[position - 1];
  const detail = row && question.data ? { ...question.data, state: row.state } : undefined;
  const displayedId = detail?.question.question_id ?? 0;
  const currentQuestion = detail?.question;
  const translationControl =
    (currentQuestion?.question_type === 'reading_comprehension'
      || currentQuestion?.question_type === 'listening')
    && currentQuestion.question_review?.study_translation
      ? {
          visible: showStudyTranslation,
          toggle: () => setShowStudyTranslation(visible => !visible),
        }
      : undefined;
  const mutation = useProgressMutation();
  const settledId = displayedId === id ? id : 0;
  useMemorizationExposure(settledId);
  const canAct = settledId > 0 && !mutation.isPending;
  const go = useCallback((target: number) => {
    setParams(current => { const next = new URLSearchParams(current);
      next.set('question', String(target)); return next; });
  }, [setParams]);
  const changeFilter = useCallback((key: string, value: string) => {
    setParams(current => { const next = new URLSearchParams(current);
      next.delete('question'); if (value) next.set(key, value); else next.delete(key); return next; });
  }, [setParams]);
  const previous = () => {
    const target = nearbyQuestion(rows, id, -1);
    if (target && canAct && !marking.current) go(target);
  };
  const next = () => {
    const target = nearbyQuestion(rows, id, 1);
    if (target && canAct && !marking.current) go(target);
  };
  function currentFocus() {
    const active = document.activeElement;
    return active instanceof HTMLElement && active !== document.body
      ? active : reading.current;
  }
  function openDetails(tab: DetailsTab, trigger?: HTMLElement) {
    if (!detail) return;
    detailsFocus.current = trigger ?? currentFocus();
    setDetailsTab(tab);
  }
  function openHelp(trigger?: HTMLElement) {
    helpFocus.current = trigger ?? currentFocus();
    setHelp(true);
  }
  useSavedCursor(filters.subject, settledId, setNotice);
  useLayoutEffect(() => {
    activeLocation.current = locationKey;
    setFilteredAdvance(current => current?.location === locationKey ? current : undefined);
  }, [locationKey]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function mark(state: ProgressState, advanceAfterMark = false) {
    if (!canAct || marking.current) return;
    const nextId = nearbyQuestion(rows, id, 1);
    const excluded = filters.state !== 'all' && filters.state !== state;
    const target = nextId ?? (excluded ? nearbyQuestion(rows, id, -1) : undefined);
    marking.current = true;
    if (excluded && target) setFilteredAdvance({ location: locationKey, from: id, to: target });
    try {
      await mutation.mutateAsync({ subject: filters.subject, id, state });
      if (activeLocation.current !== locationKey) return;
      if ((advanceAfterMark || excluded) && target) go(target);
      setNotice(state === 'mastered' ? '已记住，进度已保存。'
        : state === 'review' ? '已加入待复习。' : '已撤销当前标记。');
    } catch (error) {
      if (activeLocation.current === locationKey) {
        setFilteredAdvance(undefined);
        setNotice(error instanceof Error ? error.message : '保存失败，请重试。');
      }
    } finally {
      marking.current = false;
    }
  }
  useStudyShortcuts(shortcuts.enabled, {
    next, previous,
    first: () => { if (rows[0] && canAct && !marking.current) go(rows[0].question_id); },
    last: () => { const row = rows.at(-1); if (row && canAct && !marking.current) go(row.question_id); },
    search: () => { search.current?.focus(); search.current?.select(); },
    master: () => { void mark('mastered', true); },
    review: () => { void mark(detail?.state === 'review' ? 'unlearned' : 'review'); },
    clear: () => { if (detail?.state !== 'unlearned') void mark('unlearned'); },
    image: () => image.current?.click(), details: () => openDetails('question'),
    navigation: () => navigation.current?.click(), help: openHelp,
  });
  const error = study.error ?? question.error;
  return <div className="app-shell">
    <a href="#study-main" className="skip-link">跳到题目内容</a>
    <Sidebar subject={filters.subject} question={displayedId}
      onSubject={subject => setParams({ subject: String(subject) })} />
    <main id="study-main" className="workspace">
      <PageHeader overview={overview} shortcuts={shortcuts.enabled}
        onHelp={openHelp} onAnalysis={trigger => openDetails('analysis', trigger)}
        vocabulary={<VocabularyNotebook subject={filters.subject}
          questionId={currentQuestion?.source_item_id} />}
        navigation={<QuestionNavigation rows={rows} current={displayedId} status={navigationStatus}
          palaces={palaceImages.marked} conversations={conversations} onSelect={go}
          shortcuts={shortcuts.enabled} triggerRef={navigation} />} />
      <div className="study-layout">
        <section ref={reading} tabIndex={-1} className="reading-panel" aria-label="背题阅读区">
          <Filters filters={filters} chapters={overview?.chapters ?? []} onChange={changeFilter}
            shortcuts={shortcuts.enabled} searchRef={search} onSearchExit={() => reading.current?.focus()} />
          {error ? <div className="page-state" role="alert"><AlertCircle size={26} /><h2>暂时无法读取题目</h2><p>{error.message}</p>
            <button className="button outline" onClick={() => { void study.refetch(); if (id) void question.refetch(); }}>
              <RotateCcw size={15} />重新读取</button></div>
            : !ready ? <div className="page-state" role="status"><LoaderCircle className="spin" size={26} /><p>正在读取题库…</p></div>
            : rows.length === 0 ? <div className="page-state"><BookOpen size={28} /><h2>没有符合条件的题目</h2>
              <p>请调整关键词、章节或学习状态。</p><button className="button outline" onClick={() => setParams({ subject: String(filters.subject) })}>重置筛选</button></div>
            : detail ? <QuestionCard detail={detail} position={position} total={rows.length}
              pending={!canAct} shortcuts={shortcuts.enabled} imageRef={image}
              translationControl={translationControl}
              onPrevious={previous} onNext={next} onMark={mark} onDetails={openDetails} />
            : <div className="page-state" role="status"><LoaderCircle className="spin" size={26} /><p>正在加载题目…</p></div>}
        </section>
      </div>
      <div className={`save-notice ${notice ? 'visible' : ''}`} role="status" aria-live="polite">{notice}</div>
      <StudyDetails detail={detail} tab={detailsTab} onTab={setDetailsTab}
        returnFocus={detailsFocus} translationControl={translationControl} />
      <KeyboardHelp open={help} onOpenChange={setHelp} enabled={shortcuts.enabled}
        onEnabled={shortcuts.change} returnFocus={helpFocus} />
    </main>
    <QuestionAssistant questionID={displayedId} />
  </div>;
}

import { useEffect, useRef, useState } from 'react';
import type { ExamItem } from '../../api/exams';
import type { ExtendedResponse } from '../../api/generated/types.gen';
import { readyResponse } from '../question-types/model';
import { assertNever } from '../question-types/registry';
import { useExamClock, useExamSession } from './useExamSession';

export type TerminalDialog = 'submit' | 'result' | 'review' | 'help' | 'navigation' | null;

export function useExamTerminal(id: string) {
  const { query, action } = useExamSession(id);
  const session = query.data;
  const remaining = useExamClock(session);
  const [drafts, setDrafts] = useState<Record<number, number[]>>({});
  const [numbers, setNumbers] = useState<Record<number, string>>({});
  const [extended, setExtended] = useState<Record<number, ExtendedResponse>>({});
  const [dialog, setDialog] = useState<TerminalDialog>(null);
  const [feedback, setFeedback] = useState<ExamItem | null>(null);
  const [working, setWorking] = useState(false);
  const gate = useRef(false);
  const submitAfterFeedback = useRef(false);
  const resultShown = useRef(false);
  const expiring = useRef(false);
  const index = session?.current_index ?? 0;
  const item = session?.items[index];
  const finished = session?.status === 'finished';
  const selected = item?.answered ? item.selected : drafts[index] ?? [];
  const numeric = item?.answered ? item.numeric ?? '' : numbers[index] ?? '';
  const onNumeric = (value: string) =>
    setNumbers(current => ({ ...current, [index]: value }));
  const draft = item?.answered ? item.response : extended[index];
  const onDraft = (value: ExtendedResponse) =>
    setExtended(current => ({ ...current, [index]: value }));
  const busy = working || action.isPending;

  useEffect(() => {
    if (finished && !feedback && !resultShown.current) {
      resultShown.current = true;
      setDialog('result');
    }
  }, [finished, feedback]);
  useEffect(() => {
    if (!session || finished || remaining !== 0 || busy || expiring.current) return;
    expiring.current = true;
    void query.refetch().finally(() => {
      expiring.current = false;
    });
  }, [remaining, finished, busy, session?.server_now_ms]);

  function choose(sign: number) {
    if (!item || item.answered || finished || busy) return;
    const q = item.detail.question;
    switch (q.question_type) {
      case 'single_choice':
      case 'multiple_choice':
      case 'true_false': {
        if (!q.items.some(o => o.sign === sign)) return;
        const next =
          q.question_type === 'multiple_choice'
            ? selected.includes(sign)
              ? selected.filter(n => n !== sign)
              : [...selected, sign]
            : [sign];
        setDrafts(current => ({ ...current, [index]: next }));
        return;
      }
      case 'numeric':
      case 'cloze':
      case 'listening':
      case 'reading_comprehension':
      case 'writing':
      case 'translation':
        return;
      default:
        assertNever(q);
    }
  }

  async function navigate(target: number, preview = false) {
    if (!session || !item || gate.current || target < 0 || target >= session.items.length) {
      return;
    }
    gate.current = true;
    setWorking(true);
    try {
      if (finished) {
        await action.mutateAsync({ kind: 'move', index: target });
        setDialog(null);
        return;
      }
      const response = await action.mutateAsync({
        kind: 'navigate',
        from: index,
        target,
        response: item.answered
          ? {}
          : readyResponse(draft) ?? {
              selected,
              numeric: numeric.trim() || undefined,
            },
      });
      const committed = response.items[index];
      setDrafts(current => {
        const next = { ...current };
        delete next[index];
        return next;
      });
      if (!item.answered && committed?.answered && committed.correct === false) {
        submitAfterFeedback.current = preview;
        setFeedback(committed);
        setDialog(null);
      } else if (preview && response.status === 'in_progress') {
        setDialog('submit');
      } else {
        setDialog(null);
      }
    } catch {
      /* The mutation retains the error and resynchronizes the saved state. */
    } finally {
      gate.current = false;
      setWorking(false);
    }
  }

  function next() {
    if (!session) return;
    if (index === session.items.length - 1 && !finished) void navigate(index, true);
    else void navigate(index + 1);
  }
  function closeFeedback() {
    setFeedback(null);
    if (submitAfterFeedback.current && !finished) setDialog('submit');
    submitAfterFeedback.current = false;
  }
  async function submit() {
    if (gate.current) return;
    gate.current = true;
    setWorking(true);
    try {
      await action.mutateAsync({ kind: 'submit' });
      setDialog('result');
      resultShown.current = true;
    } catch {
      /* Display the mutation error and leave confirmation available for retry. */
    } finally {
      gate.current = false;
      setWorking(false);
    }
  }
  return {
    query,
    action,
    session,
    remaining,
    index,
    item,
    selected,
    busy,
    finished,
    draft,
    onDraft,
    dialog,
    setDialog,
    feedback,
    closeFeedback,
    choose,
    numeric,
    onNumeric,
    navigate,
    next,
    submit,
  };
}

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/practice';
import { QuestionCard } from './QuestionCard';
import { QuestionPreview } from './QuestionPreview';
import { StudyDetails, type DetailsTab } from './StudyDetails';

export type SessionCommands = {
  choose: (sign: number) => void; confirm: () => void; retry: () => void;
  image: () => void; details: () => void; analysis: (trigger?: HTMLElement) => void;
};
type Props = { id: number; position: number; total: number; shortcuts: boolean;
  commands: Ref<SessionCommands>; onPrevious: () => void; onNext: () => void;
  onPending: (pending: boolean) => void; onRevealed: (value: boolean) => void; onResult: (result: api.AttemptResult) => void };

export function PracticeSession(props: Props) {
  const [round, setRound] = useState(0);
  return <AnswerRound key={round} {...props} onRetry={() => setRound(value => value + 1)} />;
}

function AnswerRound({ id, position, total, shortcuts, commands, onPrevious, onNext,
  onPending, onResult, onRetry, onRevealed }: Props & { onRetry: () => void }) {
  const [presentationID] = useState(() => crypto.randomUUID());
  const query = useQuery({ queryKey: ['presentation', presentationID],
    queryFn: ({ signal }) => api.presentation(presentationID, id, signal) });
  const client = useQueryClient();
  const [selected, setSelected] = useState<number[]>([]);
  const [numeric, setNumeric] = useState('');
  const [result, setResult] = useState<api.AttemptResult>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const [tab, setTab] = useState<DetailsTab | null>(null);
  const locked = useRef(false);
  const image = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => () => onPending(false), [onPending]);
  useEffect(() => onRevealed(false), [onRevealed]);

  function choose(sign: number) {
    if (locked.current || result || !query.data?.detail.question.items.some(item => item.sign === sign)) return;
    setSelected(current => query.data!.detail.question.question_type === 2
      ? current.includes(sign) ? current.filter(value => value !== sign) : [...current, sign]
      : [sign]);
    document.querySelector<HTMLButtonElement>(`.practice-shell .choice-option[data-sign="${sign}"]`)
      ?.focus();
  }
  function openDetails(next: DetailsTab, trigger?: HTMLElement) {
    returnFocus.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    if (result) setTab(next);
    else if (next === 'question') setPreview(true);
  }
  async function submit() {
    if (locked.current || result || !query.data) return;
    const number = query.data.detail.question.question_type === 4 ? numeric.trim() : undefined;
    if (number === '' || (number === undefined && selected.length === 0)) return;
    locked.current = true; setPending(true); onPending(true); setError('');
    try {
      const saved = await api.answer(presentationID, selected, number);
      setResult(saved); onRevealed(true); onResult(saved);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['practice-overview'] }),
        client.invalidateQueries({ queryKey: ['practice-questions'] }),
        client.invalidateQueries({ queryKey: ['analysis'] }),
      ]);
    } catch (failure) { setError(failure instanceof Error ? failure.message : '保存失败，请重试。'); }
    finally { locked.current = false; setPending(false); onPending(false); }
  }
  function confirm() {
    if (locked.current) return;
    if (result) onNext();
    else void submit();
  }
  useImperativeHandle(commands, () => ({ choose, confirm,
    retry: () => { if (result && !locked.current) onRetry(); },
    image: () => image.current?.click(), details: () => openDetails('question'),
    analysis: trigger => { if (result) openDetails('analysis', trigger); },
  }));
  if (query.error) return <div className="page-state" role="alert"><p>{query.error.message}</p>
    <button className="button outline" onClick={() => { void query.refetch(); }}>重新读取</button></div>;
  if (!query.data) return <div className="page-state" role="status">正在载入答题…</div>;
  return <>
    <QuestionCard presentation={query.data} result={result} selected={selected}
      numeric={numeric} onNumeric={setNumeric}
      position={position} total={total} pending={pending} shortcuts={shortcuts}
      imageRef={image} onChoose={choose} onSubmit={() => { void submit(); }}
      onRetry={onRetry} onPrevious={onPrevious} onNext={onNext} onDetails={openDetails} />
    {error && <div className="practice-error" role="alert">{error}</div>}
    <QuestionPreview detail={query.data.detail} open={preview} onOpenChange={setPreview} returnFocus={returnFocus} />
    <StudyDetails detail={result?.detail} tab={tab} onTab={setTab} returnFocus={returnFocus} />
  </>;
}

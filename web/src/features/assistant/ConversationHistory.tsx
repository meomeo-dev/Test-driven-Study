import { useSearchParams } from 'react-router';
import { readSubject, useWorkspace } from '../../app/workspace';
import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight, LoaderCircle } from 'lucide-react';
import { conversations, type ConversationSummary } from '../../api/conversations';

export function ConversationHistory({ questionID, selected, onSelect, onBack }: {
  questionID: number; selected?: string; onSelect: (item: ConversationSummary) => void;
  onBack: () => void;
}) {
  const [params] = useSearchParams();
  const workspace = useWorkspace(readSubject(params));
  const course = workspace.course?.id ?? params.get('course') ?? undefined;
  const [all, setAll] = useState(false);
  const history = useInfiniteQuery({
    queryKey: ['assistant-history', course, all ? 0 : questionID], initialPageParam: '',
    queryFn: ({ pageParam, signal }) => conversations(all ? 0 : questionID, pageParam, signal, course),
    getNextPageParam: page => page.next_cursor || undefined, retry: false,
  });
  return <section className="tutor-history" aria-label="历史对话">
    <div className="tutor-history-toolbar">
      <button onClick={onBack} className="tutor-back"><ArrowLeft size={14} />返回对话</button>
      <div role="group" aria-label="历史范围">
        <button aria-pressed={!all} onClick={() => setAll(false)}>本题</button>
        <button aria-pressed={all} onClick={() => setAll(true)}>全部题目</button>
      </div>
    </div>
    {history.isPending && <p role="status"><LoaderCircle size={14} className="spin" /> 正在读取历史…</p>}
    {history.error && <p className="tutor-error" role="alert">{history.error.message}
      <button onClick={() => void history.refetch()}>重试</button></p>}
    {history.data?.pages.flatMap(page => page.items).map(item =>
      <button className="tutor-history-item" key={item.id} onClick={() => onSelect(item)}
        aria-current={item.id === selected ? 'true' : undefined}>
        <strong>{item.title || '新对话'}</strong>
        <span>{workspace.units.find(unit => unit.subject_id === item.subject_id)?.title ?? '课程'} · #{item.question_id} · {item.message_count} 条消息
          {item.active_turn_id ? ' · 回复中' : ''}</span>
        <p title={item.question_title}>{item.question_title}</p>
        <time dateTime={new Date(item.updated_at_ms).toISOString()}>
          {new Date(item.updated_at_ms).toLocaleString()}</time><ChevronRight size={15} />
      </button>)}
    {history.data?.pages[0]?.items.length === 0 && <p>暂无历史对话，先问问这道题吧。</p>}
    {history.hasNextPage && <button className="tutor-load-more" disabled={history.isFetchingNextPage}
      onClick={() => void history.fetchNextPage()}>加载更多</button>}
  </section>;
}

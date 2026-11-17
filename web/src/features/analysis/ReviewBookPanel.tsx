import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Modal } from '../../components/Modal';
import { reviewBook, type ReviewItem } from '../../api/practice';

const statuses: Record<ReviewItem['status'], string> = {
  needs_review: '待复习', learning: '巩固中', due: '复习到期', mastered: '已掌握',
};
const filters = [
  { id: 'pending', label: '待复习' },
  { id: 'mastered', label: '已掌握' },
  { id: 'all', label: '全部' },
] as const;
const date = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' });
const pageSize = 30;

function practiceLink(subject: number, item: ReviewItem) {
  const state = item.status === 'mastered' ? '' : '&state=review';
  return `/practice?subject=${subject}&question=${item.question_id}${state}`;
}

function ReviewRow({ item, subject }: { item: ReviewItem; subject: number }) {
  const sources = [
    item.practice_errors > 0 && `练习错 ${item.practice_errors} 次`,
    item.exam_errors > 0 && `模拟考错 ${item.exam_errors} 次`,
    item.help_requests > 0 && `问过助手 ${item.help_requests} 次`,
  ].filter(Boolean);
  return <li className="review-row">
    <div className="review-score" aria-label={`易错分 ${item.score}`}>
      <strong>{item.score}</strong><small>易错分</small>
    </div>
    <div className="review-question">
      <p>{item.title}</p>
      <div className="review-meta">
        <span title={item.chapter_name}>#{item.question_id}</span>
        <span className={item.status === 'mastered' ? 'review-mastered' : undefined}>
          {statuses[item.status]}
        </span>
        {sources.map(source => <span key={String(source)}>{source}</span>)}
      </div>
      <div className="review-meta">
        {item.last_answered_at_ms && <span>
          上次{item.last_correct ? '答对' : '答错'} {date.format(item.last_answered_at_ms)}
        </span>}
        <span>间隔确认 {item.confirmations} 次</span>
        {item.next_review_at_ms && <span>
          {item.status === 'due' ? '到期' : '下次复习'} {date.format(item.next_review_at_ms)}
        </span>}
      </div>
    </div>
    <Link className="button text" to={practiceLink(subject, item)}
      aria-label={`复习题目 ${item.question_id}`}>复习</Link>
  </li>;
}

export function ReviewBookPanel({ subject }: { subject: number }) {
  const query = useQuery({ queryKey: ['analysis', 'review', subject],
    queryFn: ({ signal }) => reviewBook(subject, signal), staleTime: 0,
    refetchOnMount: 'always', refetchOnWindowFocus: true, refetchInterval: 60_000 });
  const [filter, setFilter] = useState<(typeof filters)[number]['id']>('pending');
  const [limit, setLimit] = useState(pageSize);
  const [method, setMethod] = useState(false);
  const methodButton = useRef<HTMLButtonElement>(null);
  const items = query.data?.items ?? [];
  const pending = items.filter(item => item.status !== 'mastered');
  const mastered = items.filter(item => item.status === 'mastered');
  const groups = { pending, mastered, all: items };
  const visible = groups[filter];
  return <section className="review-book" aria-label="错题本">
    <div className="review-toolbar">
      <div className="review-filters" role="group" aria-label="复习状态">
        {filters.map(({ id, label }) => <button type="button" key={id}
          aria-pressed={filter === id} onClick={() => { setFilter(id); setLimit(pageSize); }}>
          {label} <span>{groups[id].length}</span>
        </button>)}
      </div>
      <div className="review-tools">
        <button type="button" className="button text" ref={methodButton}
          onClick={() => setMethod(true)}>易错分说明</button>
        {pending[0] && <Link className="button primary" to={practiceLink(subject, pending[0])}>
          开始复习
        </Link>}
      </div>
    </div>
    {query.error ? <div className="page-state" role="alert"><p>{query.error.message}</p>
      <button className="button outline" onClick={() => void query.refetch()}>重试</button></div>
      : !query.data ? <div className="page-state" role="status">正在整理错题…</div>
      : visible.length === 0 ? <div className="page-state">
        {items.length === 0 ? <p>本科目错题本为空。练习或模拟考答错、向助手提问后会自动收录。</p>
          : <p>{filter === 'mastered' ? '还没有通过间隔确认的题目。' : '当前没有待复习的题目。'}</p>}
      </div> : <div className="review-list">
        <ul>{visible.slice(0, limit).map(item =>
          <ReviewRow key={item.question_id} item={item} subject={subject} />)}</ul>
        {limit < visible.length && <button type="button" className="button secondary review-more"
          onClick={() => setLimit(value => value + pageSize)}>显示更多</button>}
      </div>}
    <Modal title="易错分说明" open={method} onOpenChange={setMethod} returnFocus={methodButton}>
      <div className="analysis-method">
        <p>易错分结合近期错答、距上次间隔确认的时间、尚未巩固的错误和待复查提问。分数越高越先复习。</p>
        <p>相邻的作答或提问间隔至少 24 小时，答对才计作独立确认。首次确认后，至少隔 1 天和再隔 3 天各答对一次，进入已掌握。</p>
        <p>接下来按 7、14、30 天复习。答错会重置当前确认次数，到期会重新进入待复习。提问会提示复查，之后的独立答对可以解除提示。</p>
      </div>
    </Modal>
  </section>;
}

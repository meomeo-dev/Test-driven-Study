import { useWorkspace } from '../../app/workspace';
import { useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { ListTodo, RefreshCw } from 'lucide-react';
import * as api from '../../api/palace';
import { Modal } from '../../components/Modal';
import { TaskActions } from './TaskActions';

export function TaskManager({ subject }: { subject: number }) {
  const workspace = useWorkspace(subject);
  const course = workspace.course?.id ?? '';
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const active = useQuery({queryKey: ['palace-tasks', 'count', course],
    queryFn: ({signal}) => api.tasks('active', '', signal, course), refetchInterval: 5000});
  const count = active.data?.tasks.length ?? 0;
  return <>
    <button ref={trigger} className="button secondary" onClick={() => setOpen(true)}>
      <ListTodo size={15} />任务{count ? ` (${count})` : ''}</button>
    <Modal open={open} onOpenChange={setOpen} title="任务管理" returnFocus={trigger} wide>
      {open && <TaskList course={course} units={workspace.units} onClose={() => setOpen(false)} />}
    </Modal>
  </>;
}

function TaskList({ onClose, course, units }: {
  onClose: () => void; course: string; units: { subject_id: number; title: string }[];
}) {
  const [scope, setScope] = useState<'active' | 'all'>('active');
  const navigate = useNavigate();
  const query = useInfiniteQuery({queryKey: ['palace-tasks', 'list', course, scope],
    initialPageParam: '', queryFn: ({pageParam, signal}) => api.tasks(scope, pageParam, signal, course),
    getNextPageParam: last => last.next_cursor || undefined, refetchInterval: 2500});
  function go(job: Pick<api.PalaceJob, 'id' | 'question_id' | 'subject_id'>) {
    navigate(`/palace?subject=${job.subject_id}&question=${job.question_id}&job=${job.id}`);
    onClose();
  }
  const tasks = query.data?.pages.flatMap(page => page.tasks) ?? [];
  return <div className="task-manager">
    <div className="task-toolbar">
      <label>显示<select aria-label="任务范围" value={scope}
        onChange={event => setScope(event.target.value as typeof scope)}>
        <option value="active">未完成任务</option><option value="all">全部任务</option>
      </select></label>
      <button className="button secondary" onClick={() => { void query.refetch(); }}>
        <RefreshCw size={14} />刷新任务</button>
    </div>
    <p className="dialog-note">跨题目查看与控制。暂停在当前步骤完成并保存后生效；继续沿原任务执行。
      终止会取消本地执行，已提交的上游请求仍可能完成或计费。</p>
    {query.error && <p role="alert">{query.error.message}</p>}
    {query.isPending ? <p role="status">读取任务…</p> : tasks.length === 0 && <p>暂无任务</p>}
    <div className="task-list">{tasks.map(task => <article className="task-card" key={task.id}
      aria-label={`题号 ${task.question_id} 的任务 ${task.id}`}>
      <header><b>#{task.question_id} · {units.find(unit => unit.subject_id === task.subject_id)?.title ?? '课程'}</b>
        <span className="task-status" data-state={task.status}>{api.statusLabel[task.status]}</span></header>
      <p className="task-title">{task.title}</p>
      <small>{task.stage === 'planning' ? 'LLM 记忆构思' : '生图与保存'} · {task.model}
        {' · '}{new Date(task.created_at_ms).toLocaleString()}</small>
      {task.error && <p role="note">{task.error.message}</p>}
      <div className="task-card-controls"><TaskActions task={task} onRetry={go} />
        <button className="button text" onClick={() => go(task)}>查看题目</button></div>
      <TaskEvents id={task.id} />
    </article>)}</div>
    {query.hasNextPage && <button className="button outline" disabled={query.isFetchingNextPage}
      onClick={() => { void query.fetchNextPage(); }}>加载更早任务</button>}
  </div>;
}

function TaskEvents({id}: {id: string}) {
  const [open, setOpen] = useState(false);
  const query = useQuery({queryKey: ['palace-tasks', 'events', id], enabled: open,
    queryFn: ({signal}) => api.events(id, signal), refetchInterval: open ? 2500 : false});
  return <details onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>状态记录</summary>
    <small className="task-id">{id}</small>
    {query.error && <p role="alert">{query.error.message}</p>}
    <ol className="task-events">{query.data?.map(event => <li key={event.id}>
      <time>{new Date(event.created_at_ms).toLocaleTimeString()}</time>{' '}
      {event.kind === 'historical_snapshot' ? '迁移时状态快照：' : ''}
      {event.from_state && `${label(event.from_state)} → `}{label(event.to_state)}
    </li>)}</ol>
  </details>;
}

function label(state: string) {
  return api.statusLabel[state as keyof typeof api.statusLabel] || state;
}

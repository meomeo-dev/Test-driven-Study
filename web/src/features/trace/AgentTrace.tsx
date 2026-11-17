import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity } from 'lucide-react';
import type { PalaceJob } from '../../api/palace';
import { active } from '../../api/palace';
import { Modal } from '../../components/Modal';
import { entriesFrom } from './model';
import { useTaskTrace } from './useTaskTrace';
import { TraceTimeline } from './TraceTimeline';
import { TraceFeed } from './TraceFeed';
import { ImageRetryDialog } from '../palace/ImageRetryDialog';

export function AgentTrace({job}: {job: PalaceJob}) {
  const trace = useTaskTrace(job);
  const entries = useMemo(() => entriesFrom(trace.events, active(job)), [trace.events, job.status]);
  const [now, setNow] = useState(Date.now());
  const [selected, setSelected] = useState('');
  useEffect(() => {
    if (!active(job)) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [job.status]);
  const live = trace.connection === 'live' && active(job);
  return <div className="agent-trace" aria-label="Agent执行轨迹">
    <header className="trace-heading"><b><Activity size={14} />执行轨迹</b>
      <span role="status">{live ? '实时接收' : trace.connection === 'connecting' ? '读取记录…'
        : trace.connection === 'reconnecting' ? '续接中' : '已保存记录'}</span></header>
    {trace.error && <p className="trace-connection-note">{trace.error}</p>}
    {trace.limited && <p className="trace-connection-note">轨迹已达保存上限，后续显示可能不完整；任务继续执行。</p>}
    {entries.length === 0 && !active(job) && trace.connection === 'settled'
      ? <p className="trace-empty">此任务没有采集到执行轨迹。历史记录不会补造步骤或耗时。</p>
      : <><TraceTimeline entries={entries} now={now} onSelect={setSelected} selected={selected} />
        <TraceFeed entries={entries} selected={selected} /></>}
    <details className="trace-help"><summary>如何读懂轨迹</summary>
      <p>时间轴记录本地观测到的请求和事件。模型请求包含网络与服务端处理，不等于隐藏思考耗时。
        公开思考摘要仅在供应商返回时展示。参数生成不代表工具已执行；整轮返回的结果不推算执行时长。</p>
    </details>
  </div>;
}

export function TraceDialog({job, onRetry}: {job: PalaceJob; onRetry?: (job: PalaceJob) => void}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return <>
    <button ref={trigger} className="button text" onClick={() => setOpen(true)}><Activity size={13} />执行轨迹</button>
    <Modal open={open} onOpenChange={setOpen} title="任务执行轨迹" returnFocus={trigger} wide>
      {open && <><ImageRetryDialog task={job} onRetry={next => {
        setOpen(false); onRetry?.(next);
      }} /><div className="trace-dialog-view"><AgentTrace job={job} /></div></>}
    </Modal>
  </>;
}

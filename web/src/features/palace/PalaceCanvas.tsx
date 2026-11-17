import { Download, Expand, Image, LoaderCircle, Map, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { useQuery } from '@tanstack/react-query';
import * as llm from '../../api/llm';
import { active, unfinished, imageURL, stageLabel, type PalaceJob } from '../../api/palace';
import { TaskActions } from './TaskActions';
import { ImageRetryDialog } from './ImageRetryDialog';
import { AgentTrace, TraceDialog } from '../trace/AgentTrace';

export function PalaceCanvas({ job, loading, error, onRefresh, onRetry, onDetails }: {
  job?: PalaceJob; loading: boolean; error?: string; onRefresh: () => void;
  onRetry: (job: PalaceJob) => void; onDetails: (trigger: HTMLElement) => void;
}) {
  const planID=job?.snapshot.pipeline?.plan_id;
  const planning=!!job && active(job) && job.snapshot.pipeline?.stage==='planning';
  const research=useQuery({queryKey:['llm-plan',planID],enabled:planning && !!planID,
    queryFn:({signal})=>llm.plan(planID!,signal),retry:false,refetchInterval:planning ? 1500 : false});
  const phase=research.data?.session?.phase;
  const gap=research.data?.session?.evidence_gap;
  const phaseLabel=phase==='compacting' ? '压缩会话中' : phase==='research'
    ? gap ? '补充证据中' : '检索权威资料' : phase==='continuing' ? '继续构思中' : '进行中';
  return <section className="palace-canvas palace-panel" aria-label="记忆宫殿画布">
    <header className="palace-panel-heading"><h2><Image size={16} />记忆画面</h2>
      {job && <span className="muted">{stageLabel(job)}</span>}</header>
    {job?.snapshot.pipeline && <ol className="pipeline-progress" aria-label="生成流水线阶段">
      <li data-complete={job.snapshot.pipeline.stage === 'generating'}>
        <b>1</b>LLM 记忆构思<span>{job.snapshot.retry_of ? '已复用' : job.status === 'queued' ? '等待' : job.snapshot.pipeline.stage === 'generating' ? '已完成'
          : job.status === 'paused' ? '已暂停' : active(job) ? phaseLabel : job.status === 'failed' ? '失败' : '已停止'}</span></li>
      <li data-complete={job.status === 'succeeded'}><b>2</b>生图与保存<span>{job.status === 'succeeded' ? '已完成'
        : job.snapshot.pipeline.stage === 'planning' ? '等待' : active(job) ? '进行中' : job.status === 'failed' ? '失败' : '已停止'}</span></li>
    </ol>}
    <div className="palace-artboard">
      {job?.status === 'succeeded' && job.image ? <Dialog.Root>
        <Dialog.Trigger asChild><button className="palace-generated" aria-label="放大记忆宫殿图片">
          <img src={imageURL(job.id)} alt={`题号 ${job.question_id} 的 AI 记忆宫殿`} />
          <span><Expand size={14} />放大查看</span>
        </button></Dialog.Trigger>
        <Dialog.Portal><Dialog.Overlay className="image-overlay" />
          <Dialog.Content className="image-dialog" aria-describedby={undefined}>
            <Dialog.Title className="sr-only">记忆宫殿大图</Dialog.Title>
            <img src={imageURL(job.id)} alt="放大的 AI 记忆宫殿" />
            <Dialog.Close className="dialog-close" aria-label="关闭图片"><X size={22} /></Dialog.Close>
          </Dialog.Content></Dialog.Portal>
      </Dialog.Root> : job && unfinished(job) ? <div className="palace-run-surface">
        <AgentTrace key={job.id} job={job} />
        <div className="palace-canvas-state compact-state">
          <h3>{stageLabel(job)}</h3>
          {job.status === 'pausing' && <p>当前步骤完成并保存后暂停；已提交的生图可能继续完成。</p>}
          {job.status === 'paused' && <p>检查点已保存，可沿原任务继续。</p>}
          <TaskActions task={job} onRetry={onRetry} />
        </div>
      </div> : <div className="palace-canvas-state" role="status">
        {active(job) || loading ? <LoaderCircle size={32} className="spin" /> : <Map size={40} strokeWidth={1.3} />}
        <h3>{job ? stageLabel(job) : loading ? '读取生成记录…' : '把这道题，放进记忆宫殿'}</h3>
        <p>{job?.status === 'paused' ? '进度已保存。点击继续任务，将从检查点接着执行。'
          : job?.status === 'pausing' ? '等待当前步骤完成并保存。若生图已经完成，将保留生成结果。'
          : active(job) ? gap ? '证据仍不足，正在自动补充检索与原文阅读。可在生成详情查看进度。'
          : job?.snapshot.pipeline ? '将自动完成构思和生图。可切换页面，稍后从历史查看。' : '通常需要几分钟。可切换页面，稍后从生成历史查看。'
          : job?.error?.message || error || '选择题目，生成一张专属记忆画面。'}</p>
        {job && <TaskActions task={job} onRetry={onRetry} />}
        {active(job) && <small>暂停等待当前步骤保存；终止不保证上游停止生成或计费。</small>}
        {error && <button className="button outline" onClick={onRefresh}>刷新记录</button>}
      </div>}
    </div>
    <footer className="palace-canvas-footer">
      {job && <button className="button text" onClick={event => onDetails(event.currentTarget)}>生成详情</button>}
      {job && <TraceDialog key={job.id} job={job} onRetry={onRetry} />}
      {job?.status === 'succeeded' && <ImageRetryDialog task={job} onRetry={onRetry} />}
      {job?.image ? <><span>{job.image.width} × {job.image.height}
        <small> · {(job.image.bytes / 1024 / 1024).toFixed(1)} MB · 本地保存</small></span>
        <a className="button outline" href={`${imageURL(job.id)}?download=1`} download>
          <Download size={15} />下载图片</a></>
        : <span>完整题文 · 正确答案 · 场景联想</span>}
    </footer>
  </section>;
}

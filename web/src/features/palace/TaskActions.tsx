import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/palace';
import { ImageRetryDialog } from './ImageRetryDialog';

type Props = { task: Pick<api.PalaceJob, 'id' | 'status' | 'can_retry_image'>;
  onRetry?: (job: api.PalaceJob) => void };

export function TaskActions({task, onRetry}: Props) {
  const client = useQueryClient();
  const retryID = useRef('');
  const action = useMutation({retry: false,
    mutationFn: (type: 'pause' | 'resume' | 'stop' | 'retry') => {
      if (type === 'pause') return api.pause(task.id);
      if (type === 'resume') return api.resume(task.id);
      if (type === 'stop') return api.cancel(task.id);
      retryID.current ||= crypto.randomUUID();
      return api.retry(task.id, retryID.current);
    }, onSuccess: (job, type) => {
      client.setQueryData(['palace-job', job.id], job);
      for (const key of ['palace-tasks', 'palace-history', 'llm-plan']) {
        void client.invalidateQueries({queryKey: [key]});
      }
      if (type === 'retry') { retryID.current = ''; onRetry?.(job); }
    }});
  const terminal = !api.unfinished(task);
  return <div className="task-actions">
    {(task.status === 'queued' || task.status === 'running') &&
      <button className="button secondary" disabled={action.isPending}
        onClick={() => action.mutate('pause')}>暂停任务</button>}
    {task.status === 'pausing' && <span role="status">等待当前步骤保存…</span>}
    {task.status === 'paused' && <button className="button primary" disabled={action.isPending}
      onClick={() => action.mutate('resume')}>继续任务</button>}
    {!terminal && <button className="button outline" disabled={action.isPending}
      onClick={() => action.mutate('stop')}>终止任务</button>}
    {terminal && <ImageRetryDialog task={task} onRetry={onRetry} />}
    {terminal && <button className="button outline" disabled={action.isPending}
      onClick={() => action.mutate('retry')}>重跑完整流程</button>}
    {action.error && <p role="alert">{action.error.message}；请刷新记录确认任务状态。</p>}
  </div>;
}

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/palace';
import { Modal } from '../../components/Modal';
import { ImageParameters } from './ImageParameters';
import { usePalacePreferences } from './hooks';
import { imagePreferences, readPreferences, type Preferences } from './preferences';
import { clearImageRetry, imageRetryRequest, pendingImageRetry } from './image-retry-request';

export function ImageRetryDialog({task, onRetry}: {
  task: Pick<api.PalaceJob, 'id' | 'can_retry_image'>;
  onRetry?: (job: api.PalaceJob) => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const client = useQueryClient();
  const preferences = usePalacePreferences('');
  const source = useQuery({queryKey: ['palace-job', task.id], enabled: open,
    queryFn: ({signal}) => api.job(task.id, signal), retry: false});
  const info = useQuery({queryKey: ['palace-info'], enabled: open,
    queryFn: ({signal}) => api.info(signal), staleTime: 0, retry: false});
  const action = useMutation({retry: false,
    mutationFn: (value: Preferences) => api.retryImage(task.id, imageRetryRequest(task.id, value)),
    onSuccess: (job, value) => {
      client.setQueryData(['palace-job', job.id], job);
      for (const key of ['palace-history', 'palace-tasks', 'palace-coverage']) {
        void client.invalidateQueries({queryKey: [key]});
      }
      clearImageRetry(task.id, job.id); preferences.change(value);
      setOpen(false); onRetry?.(job);
    }});
  if (!task.can_retry_image) return null;
  return <>
    <button ref={trigger} className="button primary" onClick={() => setOpen(true)}>仅重跑生图</button>
    <Modal open={open} onOpenChange={setOpen} title="仅重跑生图" returnFocus={trigger}>
      {open && source.data && info.data ? <ImageRetryForm key={task.id}
        source={source.data} info={info.data} busy={action.isPending}
        error={action.error?.message} onSubmit={value => action.mutate(value)} />
        : <p role={source.error || info.error ? 'alert' : 'status'}>
          {source.error?.message || info.error?.message || '读取已保存的提示词与生图设置…'}</p>}
    </Modal>
  </>;
}

function ImageRetryForm({source, info, busy, error, onSubmit}: {
  source: api.PalaceJob; info: api.PalaceInfo; busy: boolean; error?: string;
  onSubmit: (value: Preferences) => void;
}) {
  const pending = pendingImageRetry(source.id);
  const [value, setValue] = useState<Preferences>(() => {
    const saved = pending ? readPreferences(JSON.stringify(pending), '')
      : imagePreferences(source.snapshot.settings);
    return {...saved, model: pending || info.models.includes(saved.model) ? saved.model : ''};
  });
  const confirming = pending && Object.entries(value).every(([k, v]) =>
    pending[k as keyof Preferences] === v);
  return <form className="palace-settings image-retry-form" onSubmit={event => {
    event.preventDefault(); onSubmit(value);
  }}>
    <p className="dialog-note">复用此任务已保存的最终提示词和原题参考图，直接生成新图。
      不重新构思或搜索，原任务与图片继续保留。</p>
    <p className="dialog-note">题号 #{source.question_id} · 原尺寸 {source.snapshot.settings.size}
      {' · '}{source.snapshot.settings.use_reference ? '保留原题参考图' : '原任务未使用参考图'}</p>
    <ImageParameters value={value} models={info.models} disabled={busy} onChange={setValue} />
    {!info.models.includes(source.snapshot.settings.model) &&
      <p role="note">原生图模型当前不可用，请选择可用模型。</p>}
    <details><summary>复用的完整提示词</summary>
      <textarea readOnly aria-label="复用的完整提示词" value={source.snapshot.prompt} /></details>
    {error && <p role="alert">{error}。再次确认相同参数会复用提交编号。</p>}
    {confirming && <p role="note">存在尚未确认的提交；确认相同参数会查询或恢复原提交，不重复生图。</p>}
    <button className="button primary" type="submit"
      disabled={busy || !source.can_retry_image || (!confirming && (!info.ready || !value.model))}>
      {busy ? '正在提交…' : confirming ? '确认上次提交' : '仅生成新图'}</button>
  </form>;
}

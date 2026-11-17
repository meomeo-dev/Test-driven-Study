import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, History, Settings2, Sparkles } from 'lucide-react';
import type { Detail } from '../../api/client';
import * as api from '../../api/palace';
import { Modal } from '../../components/Modal';
import { PalaceSource } from './PalaceSource';
import { PalaceSettings, PalaceHistory } from './PalaceSettings';
import { PalaceCanvas } from './PalaceCanvas';
import { usePalacePreferences } from './hooks';
import { sizes } from './preferences';
import { PipelineControls } from './PipelineControls';
import { PipelineRecord } from './PipelineRecord';
import { usePipelineSettings } from './pipeline-preferences';

type Props = { detail: Detail; info?: api.PalaceInfo; jobs: api.PalaceJob[];
  selected?: string; onSelect: (job: api.PalaceJob) => void; onJobID: (id: string) => void };

export function PalaceWorkspace({ detail, info, jobs, selected, onSelect, onJobID }: Props) {
  const q = detail.question;
  const client = useQueryClient();
  const reference = detail.image_available && q.image_type !== 2;
  const preferences = usePalacePreferences(info?.default_model ?? '');
  const [context, setContext] = useState({
    palace_address: '', use_reference: reference,
  });
  const [dialog, setDialog] = useState<'settings' | 'history' | 'source' | 'prompt' | 'record' | null>(null);
  const [notice, setNotice] = useState('');
  const pipeline = usePipelineSettings();
  const focus = useRef<HTMLElement | null>(null);
  const submitted = useRef<api.PalaceCreate | null>(null);
  const restored = useRef('');
  const contextEdited = useRef(false);
  const jobID = selected || jobs.find(job => job.question_id === q.question_id)?.id;
  const query = useQuery({ queryKey: ['palace-job', jobID], enabled: !!jobID,
    queryFn: ({ signal }) => api.job(jobID!, signal), retry: false,
    refetchInterval: query => api.unfinished(query.state.data) ? 2000 : false });
  useEffect(() => {
    const saved = query.data;
    if (!saved || saved.question_id !== q.question_id || restored.current === saved.id) return;
    restored.current = saved.id;
    if (!contextEdited.current) {
      setContext({ palace_address: saved.snapshot.settings.palace_address,
      use_reference: reference && saved.snapshot.settings.use_reference });
    }
  }, [query.data, q.question_id]);
  useEffect(() => {
    if (query.data?.status !== 'succeeded') return;
    void client.invalidateQueries({ queryKey: ['palace-coverage', q.subject_id] });
    void client.invalidateQueries({ queryKey: ['palace-history', q.subject_id] });
    if(query.data.snapshot.pipeline?.plan_id) void client.invalidateQueries({queryKey:['llm-plan',query.data.snapshot.pipeline.plan_id]});
  }, [query.data?.id, query.data?.status, client, q.subject_id]);
  const prompt = useMutation({ mutationFn: () => api.preview(q.question_id, context.palace_address) });
  const create = useMutation({ mutationFn: api.create, retry: false,
    onSuccess: job => {
      client.setQueryData(['palace-job', job.id], job);
      void client.invalidateQueries({ queryKey: ['palace-history'] });
      setNotice('任务已保存，可以切页后从历史继续查看。');
    },
  });
  const busy = create.isPending || api.active(query.data);
  const savedPreferences = preferences.value;
  const model = info?.models.includes(savedPreferences.model) ? savedPreferences.model : info?.default_model || '';
  const value: api.PalaceSettings = { ...context, ...savedPreferences, model,
    generation_mode: 'pipeline', llm: pipeline.value,
    size: sizes[savedPreferences.aspect_ratio][savedPreferences.resolution] as api.PalaceSettings['size'] };
  function setSettings(next: api.PalaceSettings) {
    contextEdited.current = true;
    setContext({ palace_address: next.palace_address, use_reference: next.use_reference });
    preferences.change({ model: next.model, quality: next.quality,
      aspect_ratio: next.aspect_ratio ?? '9:16', resolution: next.resolution ?? '2k' });
  }
  function open(next: typeof dialog, trigger: HTMLElement) {
    focus.current = trigger; setDialog(next);
    if (next === 'prompt') { prompt.reset(); prompt.mutate(); }
  }
  function generate() {
    if (!info?.ready || !pipeline.ready || busy) return;
    const input = { question_id: q.question_id, ...value };
    // Reuse the request ID after an uncertain network result. Terminal jobs
    // require an explicit new submission; polling never repeats provider calls.
    const previous = submitted.current;
    const sameInput = previous && JSON.stringify({ ...previous, id: '' }) === JSON.stringify({ id: '', ...input });
    const reuse = create.isError && sameInput;
    const request = reuse ? previous : { id: crypto.randomUUID(), ...input };
    submitted.current = request;
    onJobID(request.id); setNotice(''); create.mutate(request);
  }
  async function copyPrompt() {
    const text = dialog === 'record' ? query.data!.snapshot.prompt : prompt.data!.prompt;
    try { await navigator.clipboard.writeText(text); setNotice('完整提示词已复制。'); }
    catch { setNotice('无法访问剪贴板，请在提示词框内全选复制。'); }
  }
  const settingsPanel = <><PipelineControls info={pipeline.query.data} value={pipeline.value}
    onChange={pipeline.change} disabled={busy} error={pipeline.query.error?.message} /><PalaceSettings info={info} value={value} onChange={setSettings}
    reference={reference} disabled={busy} onPrompt={() => {
      focus.current = document.activeElement as HTMLElement; setDialog('prompt');
      prompt.reset(); prompt.mutate();
    }} /></>;
  const historyPanel = <PalaceHistory jobs={jobs} selected={jobID} onSelect={job => {
    contextEdited.current = false;
    setContext({ palace_address: job.snapshot.settings.palace_address,
      use_reference: reference && job.snapshot.settings.use_reference });
    setDialog(null); onSelect(job);
  }} />;
  return <>
    <div className="palace-actionbar">
      <span className="palace-current">题号 <b>#{q.source_item_id ?? q.question_id}</b></span>
      <button className="button secondary palace-source-trigger" onClick={event => open('source', event.currentTarget)}>原题</button>
      <div className="palace-action-spacer" />
      <button className="button secondary palace-settings-trigger" onClick={event => open('settings', event.currentTarget)}><Settings2 size={15} />设置</button>
      <button className="button secondary palace-history-trigger" onClick={event => open('history', event.currentTarget)}><History size={15} />历史</button>
      <button className="button primary" disabled={!info?.ready || !pipeline.ready || busy} onClick={generate}>
        <Sparkles size={15} />{busy ? '生成中…' : create.isError ? '重新确认提交' : query.data ? '重新构思' : '生成一张'}</button>
    </div>
    <div className="palace-layout">
      <section className="palace-panel palace-source-panel" aria-label="原题内容">
        <header className="palace-panel-heading"><h2>原题与答案</h2><span className="muted">难度 {q.difficulty}/5</span></header>
        <div className="palace-panel-scroll"><PalaceSource detail={detail} /></div>
      </section>
      <PalaceCanvas job={query.data} loading={query.isLoading || create.isPending}
        error={create.error?.message ?? query.error?.message} onRefresh={() => { void query.refetch(); }}
        onRetry={onSelect} onDetails={trigger => open('record', trigger)} />
      <aside className="palace-controls" aria-label="生成设置与历史">
        <section className="palace-panel palace-settings-panel">
          <header className="palace-panel-heading"><h2><Settings2 size={15} />生成设置</h2>
            <span className="palace-connection">{info?.ready ? info.proxy_enabled ? '代理已配置' : '本地端点' : '未配置'}</span></header>
          <div className="palace-panel-scroll">{settingsPanel}</div>
        </section>
        <section className="palace-panel palace-history-panel">
          <header className="palace-panel-heading"><h2><History size={15} />生成历史</h2><span className="muted">本科目最近 30 条</span></header>
          <div className="palace-panel-scroll">{historyPanel}</div>
        </section>
      </aside>
    </div>
    <div className="palace-notice" role="status">{create.error?.message || notice}</div>
    <Modal open={dialog !== null} onOpenChange={open => { if (!open) setDialog(null); }}
      returnFocus={focus} title={dialog === 'settings' ? '生成设置' : dialog === 'history' ? '生成历史'
        : dialog === 'source' ? '原题与答案' : dialog === 'record' ? '生成详情' : '完整生图提示词'}
      wide={dialog === 'prompt' || dialog === 'record'}>
      {dialog === 'settings' ? settingsPanel : dialog === 'history' ? historyPanel
        : dialog === 'source' ? <PalaceSource detail={detail} />
        : dialog === 'record' && query.data ? <div className="palace-prompt">
          <PipelineRecord job={query.data} />
          <p className="dialog-note">题号 #{query.data.question_id} · {query.data.snapshot.settings.model}
            {' · '}{query.data.snapshot.settings.size} · {query.data.snapshot.settings.quality}
            {' · 模板 '}{query.data.snapshot.template_version}
            {query.data.image ? ` · 返回用量 ${query.data.image.usage.total_tokens} tokens` : ''}</p>
          <textarea readOnly aria-label="该次生成的完整提示词" value={query.data.snapshot.prompt} />
          <button className="button outline" onClick={() => { void copyPrompt(); }}><Copy size={15} />复制提示词</button>
        </div> : <div className="palace-prompt">
          <p className="dialog-note">模板 {prompt.data?.template_version || info?.template_version} · 原题干、全部选项、正确答案与讲解均由本地题库填入。
            此处为模板预览；LLM 构思完成后的最终提示词会保存在生成详情中。</p>
          {prompt.isPending ? <p role="status">正在整理提示词…</p> : prompt.error ? <p role="alert">{prompt.error.message}</p>
            : prompt.data && <><textarea readOnly aria-label="完整提示词" value={prompt.data.prompt} />
              <button className="button outline" onClick={() => { void copyPrompt(); }}><Copy size={15} />复制提示词</button></>}
        </div>}
    </Modal>
  </>;
}

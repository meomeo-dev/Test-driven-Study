import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as llm from '../../api/llm';
import { active, type PalaceJob } from '../../api/palace';
import { Link } from 'react-router';

function authorityURL(raw:string) {
  try {
    const url = new URL(raw);
    const government = url.hostname === 'gov.cn' || url.hostname.endsWith('.gov.cn');
    if (url.protocol === 'https:' && !url.username && !url.password
      && (!url.port || url.port === '443') && government) return url.href;
  } catch { return; }
}

export function PipelineRecord({ job }: { job: PalaceJob }) {
  const id = job.snapshot.pipeline?.plan_id || job.snapshot.settings.plan_id;
  const [open, setOpen] = useState(false);
  const query = useQuery({ queryKey: ['llm-plan', id], enabled: open && !!id,
    queryFn: ({ signal }) => llm.plan(id!, signal), retry: false, staleTime:0, refetchOnMount:'always',
    refetchInterval: query => active(job) || query.state.data?.status==='running' ? 1500 : false });
  if (!id) return null;
  const record = query.data;
  return <details className="pipeline-record" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>LLM 构思结果{record ? ` · ${record.model}` : ''}</summary>
    {job.snapshot.retry_of && <p className="dialog-note">本次仅重跑生图，新增 LLM 用量为 0。
      以下为原构思记录及其原始用量。<Link to={`/palace?subject=${job.subject_id}&question=${job.question_id}&job=${job.snapshot.retry_of}`}>查看来源任务</Link></p>}
    {query.isLoading ? <p role="status">正在读取构思记录…</p> : record ? <div className="planning-result">
      <p className="dialog-note">{record.model} · {record.reasoning_effort} · 会话预算 {record.context_budget_k || '历史参数'}{record.context_budget_k ? ' K' : ''}
        · 累计输出 {record.usage.output_tokens} tokens（含思考与压缩）</p>
      <p className="dialog-note">原图输入 {record.references?.length ?? 0} 张/帧 · 请求 {record.session?.rounds ?? 1} 轮
        · 搜索 {record.session?.searches ?? 0} 次
        {record.session?.research_rounds !== undefined && <> · 研究 {record.session.research_rounds} 轮
          · 打开网页 {record.session.page_opens ?? 0} 次 · 页内查找 {record.session.page_finds ?? 0} 次</>}
        · 压缩 {record.session?.compactions ?? 0} 次
        {record.session?.compaction_method==='summary' ? '（同模型摘要）'
          : record.session?.compaction_method==='native' ? '（独立原生接口）'
          : record.session?.compaction_method==='codex_v2' ? '（Codex V2 加密压缩）' : ''}</p>
      {record.error && <p role="alert" className="palace-error">{record.error.message}</p>}
      {record.status === 'running' && <p role="status">LLM 正在构思，完成后会自动开始生图。</p>}
      {record.session?.evidence_gap && <details className="research-gap">
        <summary>{record.status === 'running' ? '正在补证 · 查看证据缺口' : '最后的证据缺口'}</summary>
        <p>{record.session.evidence_gap}</p>
      </details>}
      {record.plan?.research && <section className="research-result" aria-label="权威研究结果">
        <b>{record.plan.research.status==='not_requested' ? '未联网核验'
          : record.status==='succeeded' && record.plan.research.status==='supported'
            ? '权威来源支持' : record.status==='running' ? '研究评估中' : '研究未通过'}</b>
        <p>{record.plan.research.explanation}</p>
        <ul>{record.plan.research.sources.map((source,i) => <li key={i}>
          <a href={authorityURL(source.url)} target="_blank" rel="noopener noreferrer">{source.title}</a><p>{source.claim}</p></li>)}</ul>
      </section>}
      {!record.plan?.research && !!record.session?.sources?.length &&
        <section className="research-result" aria-label="检索返回的来源">
          <b>已检索来源 · 构思尚未通过</b>
          <ul>{record.session.sources.map(source => <li key={source.url}>
            <a href={authorityURL(source.url)} target="_blank" rel="noopener noreferrer">
              {source.title || source.url}</a>
          </li>)}</ul>
        </section>}
      {record.plan && <><h3>{record.plan.title}</h3><p>{record.plan.scene}</p>
        <dl>{record.plan.anchors.map((a, i) => <div key={i}><dt>{a.cue}</dt><dd>{a.meaning}</dd></div>)}</dl>
        {!!record.plan.pitfalls.length && <details><summary>核对要点</summary>
          <ul>{record.plan.pitfalls.map((p, i) => <li key={i}>{p}</li>)}</ul></details>}
        <label>用于生图的场景补充<textarea readOnly aria-label="构思场景提示词" value={record.plan.image_prompt} /></label></>}
    </div> : <p className="dialog-note">{active(job) ? '构思阶段尚未建立记录，请稍后查看。' : query.error?.message || '没有可读取的构思结果。'}</p>}
  </details>;
}

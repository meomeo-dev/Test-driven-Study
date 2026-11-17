import { Brain } from 'lucide-react';
import type { LlmInfo, LlmParameters } from '../../api/llm';
import { ReasoningParameters, effortLabels } from './ReasoningParameters';

export function PipelineControls({ info, value, onChange, disabled, error }: {
  info?: LlmInfo; value: LlmParameters; onChange: (value: LlmParameters) => void;
  disabled: boolean; error?: string;
}) {
  return <div className="pipeline-controls">
    <p className="pipeline-description"><Brain size={15} />LLM 构思 → 自动生图 → 本地保存</p>
    <details className="pipeline-parameters">
      <summary>构思参数 <span>{value.model || '未配置'}</span></summary>
      <ReasoningParameters value={value} models={info?.models || []} efforts={info?.efforts || ['default']}
        onChange={onChange} disabled={disabled || !info?.ready} />
    </details>
    <small className="dialog-note">{effortLabels[value.reasoning_effort]} · 会话预算 {value.context_budget_k ?? 274} K，预留 {value.compact_reserve_k ?? 64} K。
      原题图片自动输入 LLM，构思完成后直接生图。</small>
    {(!Number.isInteger(value.max_output_tokens_k) || value.max_output_tokens_k < 1 || value.max_output_tokens_k > 128)
      && <p role="alert" className="palace-error">会话预算无效，请检查压缩阈值与预留空间。</p>}
    {(error || (info && !info.ready)) && <p role="alert" className="palace-error">
      {error || '请在生图设置 → LLM · Responses 中配置构思服务。'}</p>}
  </div>;
}

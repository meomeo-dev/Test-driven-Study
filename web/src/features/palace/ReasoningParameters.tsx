import { useId } from 'react';
import type { LlmParameters } from '../../api/llm';

export const effortLabels: Record<string, string> = {
  default: '模型默认', none: '关闭 · none', minimal: '最少 · minimal', low: '低 · low',
  medium: '中 · medium', high: '高 · high', xhigh: '更高 · xhigh', max: '最高 · max',
};
export function ReasoningParameters({ value, models, efforts, onChange, disabled }: {
  value: LlmParameters; models: string[]; efforts: LlmParameters['reasoning_effort'][];
  onChange: (value: LlmParameters) => void; disabled?: boolean;
}) {
  const description = useId();
  const threshold = value.compact_threshold_k ?? 210;
  const reserve = value.compact_reserve_k ?? 64;
  return <div className="reasoning-parameters">
    <label>LLM 模型<select value={value.model} disabled={disabled}
      onChange={event => onChange({ ...value, model: event.target.value })}>
      {models.map(model => <option key={model}>{model}</option>)}
    </select></label>
    <label>思考强度<select value={value.reasoning_effort} disabled={disabled}
      aria-describedby={description}
      onChange={event => onChange({ ...value, reasoning_effort: event.target.value as LlmParameters['reasoning_effort'] })}>
      {efforts.map(effort => <option key={effort} value={effort}>{effortLabels[effort] || effort}</option>)}
    </select></label>
    <small id={description} className="dialog-note">1 K = 1024 tokens。单次输出由预留空间自动设置，无需另填。
      各模型支持的强度不同；“模型默认”不指定强度。</small>
    <label>联网研究<select value={value.web_search || 'required'} disabled={disabled}
      onChange={event => onChange({ ...value,
        web_search: event.target.value as 'required' | 'off' })}>
      <option value="required">内置搜索 · 必须有权威来源</option>
      <option value="off">关闭 · 不做联网核验</option>
    </select></label>
    <details className="context-budget">
      <summary>会话预算 {threshold + reserve} K · {threshold} K 触发压缩</summary>
      <div className="context-budget-fields">
        <label>会话预算（K）<input type="number" readOnly value={threshold + reserve} /></label>
        <label>压缩阈值（K）<input type="number" min={16} max={1792} step={1}
          disabled={disabled} value={threshold}
          onChange={event => onChange({ ...value,
            compact_threshold_k: event.target.valueAsNumber,
            compact_reserve_k: reserve,
            context_budget_k: event.target.valueAsNumber + reserve })} /></label>
        <label>预留空间（K）<input type="number" min={1} max={256} step={1}
          disabled={disabled} value={reserve}
          onChange={event => onChange({ ...value,
            compact_threshold_k: threshold,
            compact_reserve_k: event.target.valueAsNumber,
            max_output_tokens_k: Math.min(128, event.target.valueAsNumber),
            context_budget_k: threshold + event.target.valueAsNumber })} /></label>
      </div>
      <small className="dialog-note">默认 274 K = 210 K + 64 K。会话压缩后继续构思；单次输出受模型上限约束。
        搜索工具窗口为 128K，搜索阶段可能更早压缩。只有完整的结构化结果会进入生图。</small>
    </details>
  </div>;
}

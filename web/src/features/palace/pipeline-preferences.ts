import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as llm from '../../api/llm';

export const pipelinePreferenceKey = 'test-driven-study.pipeline-preferences.v1';
export function readPipelinePreferences(raw: string | null): llm.LlmParameters | undefined {
  if (!raw) return;
  try {
    const p = JSON.parse(raw) as Partial<llm.LlmParameters>;
    if (!p || typeof p.model !== 'string' || p.model.length > 100
      || !['default', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].includes(p.reasoning_effort || '')
      || !Number.isInteger(p.max_output_tokens_k) || p.max_output_tokens_k! < 1 || p.max_output_tokens_k! > 128) return;
    const threshold=p.compact_threshold_k ?? 210,reserve=p.compact_reserve_k ?? 64;
    const budget=p.context_budget_k ?? threshold+reserve;
    if (!Number.isInteger(threshold) || threshold<16 || !Number.isInteger(reserve) || reserve<p.max_output_tokens_k!
      || reserve>256 || budget!==threshold+reserve || budget>2048 || (p.web_search && !['required','off'].includes(p.web_search))) return;
    return {model:p.model,reasoning_effort:p.reasoning_effort!,max_output_tokens_k:p.max_output_tokens_k!,
      context_budget_k:budget,compact_threshold_k:threshold,compact_reserve_k:reserve,web_search:p.web_search || 'required'};
  } catch { return; }
}
export function usePipelineSettings() {
  const query = useQuery({ queryKey: ['llm-info'], queryFn: ({ signal }) => llm.info(signal), retry: false });
  const [saved, setSaved] = useState(() => {
    try { return readPipelinePreferences(localStorage.getItem(pipelinePreferenceKey)); }
    catch { return; }
  });
  const info = query.data;
  const value: llm.LlmParameters = {
    model: saved && info?.models.includes(saved.model) ? saved.model : info?.default_model || '',
    reasoning_effort: saved?.reasoning_effort || info?.reasoning_effort || 'default',
    max_output_tokens_k: Math.min(128,saved?.compact_reserve_k ?? info?.compact_reserve_k ?? 64),
    context_budget_k:saved?.context_budget_k ?? info?.context_budget_k ?? 274,
    compact_threshold_k:saved?.compact_threshold_k ?? info?.compact_threshold_k ?? 210,
    compact_reserve_k:saved?.compact_reserve_k ?? info?.compact_reserve_k ?? 64,
    web_search:saved?.web_search || info?.web_search || 'required',
  };
  function change(next: llm.LlmParameters) {
    setSaved(next);
    if (!Number.isInteger(next.max_output_tokens_k)) return;
    try { localStorage.setItem(pipelinePreferenceKey, JSON.stringify(next)); }
    catch { /* In-memory selection remains usable when storage is disabled. */ }
  }
  const valid = Number.isInteger(value.max_output_tokens_k) && value.max_output_tokens_k >= 1
    && value.max_output_tokens_k <= Math.min(128,value.compact_reserve_k || 64) && !!value.model
    && Number.isInteger(value.context_budget_k) && value.context_budget_k!<=2048
    && Number.isInteger(value.compact_threshold_k) && value.compact_threshold_k!>=16
    && Number.isInteger(value.compact_reserve_k) && value.compact_reserve_k!<=256
    && value.context_budget_k===value.compact_threshold_k!+value.compact_reserve_k!;
  return { query, value, change, ready: !!info?.ready && valid };
}

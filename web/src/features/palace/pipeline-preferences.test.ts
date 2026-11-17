import { expect, test } from 'vitest';
import { readPipelinePreferences } from './pipeline-preferences';

test('restores only bounded public LLM parameters', () => {
  const value = { model: 'fixture', reasoning_effort: 'high', max_output_tokens_k: 32,
    context_budget_k:274,compact_threshold_k:210,compact_reserve_k:64,web_search:'required' };
  expect(readPipelinePreferences(JSON.stringify(value))).toEqual(value);
  expect(readPipelinePreferences(JSON.stringify({...value, api_key:'never-retain'}))).toEqual(value);
  for (const change of [{ max_output_tokens_k: 0 }, { max_output_tokens_k: 129 },
    { max_output_tokens_k: 1.5 }, { reasoning_effort: 'invented' }]) {
    expect(readPipelinePreferences(JSON.stringify({ ...value, ...change }))).toBeUndefined();
  }
  expect(readPipelinePreferences('{bad')).toBeUndefined();
  expect(readPipelinePreferences(null)).toBeUndefined();
  expect(readPipelinePreferences('null')).toBeUndefined();
});

import type * as api from '../../api/palace';
import type * as llm from '../../api/llm';
import type * as tts from '../../api/tts';

export type ProviderKind = 'image' | 'llm' | 'tts';
export type AnyProviderSettings =
  | api.ProviderSettings
  | llm.LlmProviderSettings
  | tts.TtsProviderSettings;
export type AnyProviderUpdate =
  | api.ProviderUpdate
  | llm.LlmProviderUpdate
  | tts.TtsProviderUpdate;

export type ProviderFormState = {
  base: string;
  key: string;
  models: string;
  defaultVoice: 'stella' | 'tide';
  proxy: string;
  allowDirectHttps: boolean;
  clear: boolean;
  reuse: boolean;
  parameters: llm.LlmParameters;
};

export function parseModels(raw: string): string[] {
  return raw
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
}

export function resolveLlmModel(rawModels: string, selectedModel: string): string {
  const models = parseModels(rawModels);
  return models.includes(selectedModel) ? selectedModel : models[0] || '';
}

export function createProviderFormState(
  kind: ProviderKind,
  initial: AnyProviderSettings,
): ProviderFormState {
  const isTts = kind === 'tts';
  const isLlm = kind === 'llm';
  const ttsInitial = isTts ? (initial as tts.TtsProviderSettings) : undefined;
  const reasoning = isLlm ? (initial as llm.LlmProviderSettings) : undefined;
  const imageOrLlmInitial = !isTts
    ? (initial as api.ProviderSettings | llm.LlmProviderSettings)
    : undefined;

  return {
    base: initial.base_url,
    key: '',
    models: imageOrLlmInitial?.models?.join(', ') || '',
    defaultVoice: ttsInitial?.default_voice || 'stella',
    proxy: initial.proxy_url,
    allowDirectHttps: Boolean(initial.allow_direct_https),
    clear: false,
    reuse: false,
    parameters: {
      model: reasoning?.default_model || imageOrLlmInitial?.models?.[0] || '',
      reasoning_effort: reasoning?.reasoning_effort || 'medium',
      max_output_tokens_k: Math.min(128, reasoning?.compact_reserve_k || 64),
      context_budget_k: reasoning?.context_budget_k ?? 274,
      compact_threshold_k: reasoning?.compact_threshold_k ?? 210,
      compact_reserve_k: reasoning?.compact_reserve_k ?? 64,
      web_search: reasoning?.web_search || 'required',
    },
  };
}

export function buildProviderUpdate(
  kind: 'image',
  state: ProviderFormState,
): api.ProviderUpdate;
export function buildProviderUpdate(
  kind: 'llm',
  state: ProviderFormState,
): llm.LlmProviderUpdate;
export function buildProviderUpdate(
  kind: 'tts',
  state: ProviderFormState,
): tts.TtsProviderUpdate;
export function buildProviderUpdate(
  kind: ProviderKind,
  state: ProviderFormState,
): AnyProviderUpdate;
export function buildProviderUpdate(
  kind: ProviderKind,
  state: ProviderFormState,
): AnyProviderUpdate {
  const keyField =
    state.key.trim() && !state.clear ? { api_key: state.key.trim() } : {};

  if (kind === 'tts') {
    return {
      base_url: state.base.trim(),
      default_voice: state.defaultVoice,
      proxy_url: state.proxy.trim(),
      allow_direct_https: Boolean(state.allowDirectHttps),
      clear_key: state.clear,
      ...keyField,
    };
  }

  const basePayload: api.ProviderUpdate = {
    base_url: state.base.trim(),
    models: parseModels(state.models),
    proxy_url: state.proxy.trim(),
    allow_direct_https: Boolean(state.allowDirectHttps),
    clear_key: state.clear,
    reuse_key: state.reuse,
    ...keyField,
  };

  if (kind === 'llm') {
    return {
      ...basePayload,
      default_model: resolveLlmModel(state.models, state.parameters.model),
      reasoning_effort: state.parameters.reasoning_effort,
      max_output_tokens_k: state.parameters.max_output_tokens_k,
      context_budget_k: state.parameters.context_budget_k,
      compact_threshold_k: state.parameters.compact_threshold_k,
      compact_reserve_k: state.parameters.compact_reserve_k,
      web_search: state.parameters.web_search,
    };
  }

  return basePayload;
}

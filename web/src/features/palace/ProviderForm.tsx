import { useEffect, useId, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, ShieldCheck } from 'lucide-react';
import type { ProviderConnection } from '../../api/generated/types.gen';
import * as api from '../../api/palace';
import * as llm from '../../api/llm';
import * as tts from '../../api/tts';
import { ReasoningParameters } from './ReasoningParameters';
import {
  buildProviderUpdate,
  createProviderFormState,
  parseModels,
  resolveLlmModel,
  type AnyProviderSettings,
  type AnyProviderUpdate,
  type ProviderKind,
} from './provider-form-model';

function origin(value: string) { try { return new URL(value).origin; } catch { return ''; } }

export function ProviderForm({ initial, kind, onSaved, onBusy }: {
  initial: AnyProviderSettings;
  kind: ProviderKind;
  onSaved: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const isTts = kind === 'tts';
  const isLlm = kind === 'llm';
  const reasoning = isLlm ? (initial as llm.LlmProviderSettings) : undefined;
  const directHttpsHintId = useId();
  const client = useQueryClient();
  const [state, setState] = useState(() => createProviderFormState(kind, initial));

  const save = useMutation<AnyProviderSettings, Error, AnyProviderUpdate>({
    mutationFn: (input: AnyProviderUpdate) => {
      if (isTts) return tts.save(input as tts.TtsProviderUpdate, initial.write_token);
      if (isLlm) return llm.save(input as llm.LlmProviderUpdate, initial.write_token);
      return api.saveProvider(input as api.ProviderUpdate, initial.write_token);
    },
    retry: false,
    onSuccess: async () => {
      setState(prev => ({ ...prev, key: '' }));
      await client.invalidateQueries({
        queryKey: [isTts ? 'tts-settings' : isLlm ? 'llm-info' : 'palace-info'],
      });
      client.removeQueries({ queryKey: ['provider-settings', kind] });
      onSaved();
    },
  });

  const test = useMutation<ProviderConnection, Error, AnyProviderUpdate>({
    mutationFn: (input: AnyProviderUpdate) => {
      if (isTts) return tts.test(input as tts.TtsProviderUpdate, initial.write_token);
      if (isLlm) return llm.test(input as llm.LlmProviderUpdate, initial.write_token);
      return api.testProvider(input as api.ProviderUpdate, initial.write_token);
    },
    retry: false,
  });

  const changedOrigin =
    !isTts &&
    initial.key_configured &&
    origin(state.base) !== origin(initial.base_url) &&
    !state.key.trim() &&
    !state.clear;
  const busy = save.isPending || test.isPending;
  useEffect(() => { onBusy(busy); return () => onBusy(false); }, [busy, onBusy]);

  function formInput(): AnyProviderUpdate {
    return buildProviderUpdate(kind, state);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    test.reset();
    save.mutate(formInput());
  }

  return <form className="provider-form" data-kind={kind} autoComplete="off" onSubmit={submit}>
    <p className="provider-security"><ShieldCheck size={18} />密钥由本机系统凭据存储保护，后端使用，前端不回显。</p>
    <fieldset disabled={busy}>
      <p className="provider-purpose">
        {isTts
          ? 'TTS · 语音服务：负责为题目文本和选项生成自然的双语语音发音。'
          : isLlm
          ? 'LLM · Responses：只负责构思和结构化文本输出。'
          : '生图 · Images：负责生成画面和引用原题配图。'}
      </p>
      <label>Base URL<input type="url" required value={state.base} autoCapitalize="none" spellCheck={false}
        placeholder={isTts ? 'https://api.deepseek.com/v1/tools/tts' : 'https://api.openai.com/v1'}
        onChange={event => setState(prev => ({ ...prev, base: event.target.value, reuse: false }))} /></label>
      <label>API Key <span>{initial.key_configured ? '已配置 · 留空保留' : '尚未配置'}</span>
        <input type="password" value={state.key} disabled={state.clear} autoComplete="off" maxLength={1024}
          placeholder={initial.key_configured ? '留空使用已保存密钥，输入新值可替换' : (isTts ? '输入 DeepSeek API Key' : '输入服务商提供的 API Key')}
          onChange={event => setState(prev => ({ ...prev, key: event.target.value }))} /></label>
      {initial.key_configured && <label className="provider-check"><input type="checkbox" checked={state.clear}
        onChange={event => setState(prev => ({ ...prev, clear: event.target.checked, key: '' }))} />
        {isTts ? '清除当前 TTS 密钥并停用语音服务' : isLlm ? '清除当前 LLM 密钥并停用构思' : '清除当前应用密钥并停用生图'}</label>}
      {changedOrigin && <label className="provider-check provider-reuse"><input type="checkbox" checked={state.reuse}
        onChange={event => setState(prev => ({ ...prev, reuse: event.target.checked }))} />允许将已保存密钥用于新的接口域名</label>}
      {!isTts && <label className="provider-models">模型名称<input required value={state.models} maxLength={1600} spellCheck={false}
        placeholder={isLlm ? '服务商支持的 Responses 模型' : 'gpt-image-2, 其他模型名称'}
        onChange={event => setState(prev => ({ ...prev, models: event.target.value }))} />
        <small>多个模型用英文逗号分隔；填写该服务实际支持的名称。</small></label>}
      {reasoning && <ReasoningParameters
        value={{ ...state.parameters, model: resolveLlmModel(state.models, state.parameters.model) }}
        models={parseModels(state.models)}
        efforts={reasoning.efforts}
        onChange={parameters => setState(prev => ({ ...prev, parameters }))} />}
      {isTts && <fieldset className="provider-voice-fieldset">
        <legend>默认音色 (Default Voice)</legend>
        <div className="provider-voice-options">
          <label className="provider-radio">
            <input type="radio" name="default_voice" value="stella"
              checked={state.defaultVoice === 'stella'}
              onChange={() => setState(prev => ({ ...prev, defaultVoice: 'stella' }))} />
            <span>stella (女声 · 纯正英美音，清晰标准)</span>
          </label>
          <label className="provider-radio">
            <input type="radio" name="default_voice" value="tide"
              checked={state.defaultVoice === 'tide'}
              onChange={() => setState(prev => ({ ...prev, defaultVoice: 'tide' }))} />
            <span>tide (男声 · 沉稳共鸣，适合对话)</span>
          </label>
        </div>
      </fieldset>}
      <label className="provider-proxy">代理地址<input value={state.proxy} spellCheck={false} maxLength={1024}
        placeholder="http://127.0.0.1:代理端口"
        onChange={event => setState(prev => ({ ...prev, proxy: event.target.value }))} />
        <small>默认情况下远程服务必须配置 HTTP、HTTPS 或 SOCKS 代理，连接失败不会静默直连。
          {initial.proxy_auth_configured && ' 已保存的代理认证会在地址不变时保留。'}</small></label>
      <div className={`provider-direct-https${state.allowDirectHttps ? ' is-enabled' : ''}`}>
        <label className="provider-check">
          <input type="checkbox" checked={state.allowDirectHttps}
            aria-describedby={directHttpsHintId}
            onChange={event => setState(prev => ({ ...prev, allowDirectHttps: event.target.checked }))} />
          允许直连 HTTPS（Allow direct HTTPS）
        </label>
        <small id={directHttpsHintId} className="provider-direct-https-note">
          默认要求远程 HTTPS 服务显式配置代理；勾选后在代理地址留空时将不使用代理直接发送 HTTPS 请求（已填写代理时仍严格走代理，且始终禁止非本机明文 HTTP）。
        </small>
      </div>
    </fieldset>
    <p className="dialog-note">当前来源：{initial.storage === 'system_keyring' ? '系统凭据存储' : '本地环境配置'}。
      保存后立即生效，并优先于 {isTts ? '.env.deepseek-tts' : isLlm ? '.env.gpt' : '.env.gpt-image2'}。关闭弹窗会清空未保存的密钥输入。</p>
    {state.clear && <p className="dialog-note">清除不会撤销服务商的密钥，也不会修改原有 .env 文件。</p>}
    {(save.error || test.error) && <p role="alert" className="palace-error">{save.error?.message || test.error?.message}</p>}
    {test.data && <p role="status" className="provider-test-result">{test.data.message}</p>}
    <div className="provider-actions">
      <button type="button" className="button outline" disabled={busy || state.clear || (changedOrigin && !state.reuse)}
        onClick={() => { save.reset(); test.mutate(formInput()); }}>{test.isPending && <LoaderCircle className="spin" size={14} />}测试连接</button>
      <button type="submit" className="button primary" disabled={busy || (changedOrigin && !state.reuse)}>
        {save.isPending && <LoaderCircle className="spin" size={14} />}{save.isPending ? '正在安全保存…' : '保存并应用'}</button>
    </div>
    <p className="dialog-note">{isTts
      ? '测试仅发送轻量连接与鉴权探测，不会扣费生成完整语音。系统凭据存储不可用时会报错，不会改存明文。'
      : '测试仅查询模型列表，不会构思、生图或保存。系统凭据存储不可用时会报错，不会改存明文。'}</p>
  </form>;
}

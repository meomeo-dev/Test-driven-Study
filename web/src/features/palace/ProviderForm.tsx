import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, ShieldCheck } from 'lucide-react';
import * as api from '../../api/palace';
import * as llm from '../../api/llm';
import { ReasoningParameters } from './ReasoningParameters';

function origin(value: string) { try { return new URL(value).origin; } catch { return ''; } }

export function ProviderForm({ initial, kind, onSaved, onBusy }: {
  initial: api.ProviderSettings | llm.LlmProviderSettings; kind: 'image' | 'llm';
  onSaved: () => void; onBusy: (busy: boolean) => void;
}) {
  const reasoning = kind === 'llm' ? initial as llm.LlmProviderSettings : undefined;
  const [parameters, setParameters] = useState<llm.LlmParameters>({
    model: reasoning?.default_model || initial.models[0] || '',
    reasoning_effort: reasoning?.reasoning_effort || 'medium',
    max_output_tokens_k: Math.min(128,reasoning?.compact_reserve_k || 64),
    context_budget_k:reasoning?.context_budget_k ?? 274,compact_threshold_k:reasoning?.compact_threshold_k ?? 210,
    compact_reserve_k:reasoning?.compact_reserve_k ?? 64,web_search:reasoning?.web_search || 'required',
  });
  const client = useQueryClient();
  const [base, setBase] = useState(initial.base_url);
  const [key, setKey] = useState('');
  const [models, setModels] = useState(initial.models.join(', '));
  const [proxy, setProxy] = useState(initial.proxy_url);
  const [clear, setClear] = useState(false);
  const [reuse, setReuse] = useState(false);
  const save = useMutation({ mutationFn: (input: api.ProviderUpdate) => kind === 'llm'
      ? llm.save({ ...input, default_model: models.split(',').map(value => value.trim()).includes(parameters.model)
        ? parameters.model : models.split(',')[0]?.trim() || '', reasoning_effort: parameters.reasoning_effort,
        max_output_tokens_k: parameters.max_output_tokens_k,context_budget_k:parameters.context_budget_k,
        compact_threshold_k:parameters.compact_threshold_k,compact_reserve_k:parameters.compact_reserve_k,web_search:parameters.web_search }, initial.write_token)
      : api.saveProvider(input, initial.write_token),
    retry: false, onSuccess: async () => {
      setKey('');
      await client.invalidateQueries({ queryKey: [kind === 'llm' ? 'llm-info' : 'palace-info'] });
      client.removeQueries({ queryKey: ['provider-settings', kind] });
      onSaved();
    },
  });
  const test = useMutation({ mutationFn: (input: api.ProviderUpdate) => kind === 'llm'
      ? llm.test({ ...input, default_model: models.split(',').map(value => value.trim()).includes(parameters.model)
        ? parameters.model : models.split(',')[0]?.trim() || '', reasoning_effort: parameters.reasoning_effort,
        max_output_tokens_k: parameters.max_output_tokens_k,context_budget_k:parameters.context_budget_k,
        compact_threshold_k:parameters.compact_threshold_k,compact_reserve_k:parameters.compact_reserve_k,web_search:parameters.web_search }, initial.write_token)
      : api.testProvider(input, initial.write_token), retry: false });
  const changedOrigin = initial.key_configured && origin(base) !== origin(initial.base_url) && !key.trim() && !clear;
  const busy = save.isPending || test.isPending;
  useEffect(() => { onBusy(busy); return () => onBusy(false); }, [busy, onBusy]);
  function input(): api.ProviderUpdate {
    return { base_url: base.trim(), models: models.split(',').map(value => value.trim()).filter(Boolean),
      proxy_url: proxy.trim(), clear_key: clear, reuse_key: reuse,
      ...(key.trim() && !clear ? { api_key: key.trim() } : {}) };
  }
  function submit(event: FormEvent) {
    event.preventDefault(); test.reset(); save.mutate(input());
  }
  return <form className="provider-form" data-kind={kind} autoComplete="off" onSubmit={submit}>
    <p className="provider-security"><ShieldCheck size={18} />密钥由本机系统凭据存储保护，后端使用，前端不回显。</p>
    <fieldset disabled={busy}>
      <p className="provider-purpose">{kind === 'llm' ? 'LLM · Responses：只负责构思和结构化文本输出。' : '生图 · Images：负责生成画面和引用原题配图。'}</p>
      <label>Base URL<input type="url" required value={base} autoCapitalize="none" spellCheck={false}
        placeholder="https://api.openai.com/v1" onChange={event => { setBase(event.target.value); setReuse(false); }} /></label>
      <label>API Key <span>{initial.key_configured ? '已配置 · 留空保留' : '尚未配置'}</span>
        <input type="password" value={key} disabled={clear} autoComplete="off" maxLength={1024}
          placeholder={initial.key_configured ? '留空使用已保存密钥，输入新值可替换' : '输入服务商提供的 API Key'}
          onChange={event => setKey(event.target.value)} /></label>
      {initial.key_configured && <label className="provider-check"><input type="checkbox" checked={clear}
        onChange={event => { setClear(event.target.checked); setKey(''); }} />{kind === 'llm' ? '清除当前 LLM 密钥并停用构思' : '清除当前应用密钥并停用生图'}</label>}
      {changedOrigin && <label className="provider-check provider-reuse"><input type="checkbox" checked={reuse}
        onChange={event => setReuse(event.target.checked)} />允许将已保存密钥用于新的接口域名</label>}
      <label className="provider-models">模型名称<input required value={models} maxLength={1600} spellCheck={false}
        placeholder={kind === 'llm' ? '服务商支持的 Responses 模型' : 'gpt-image-2, 其他模型名称'} onChange={event => setModels(event.target.value)} />
        <small>多个模型用英文逗号分隔；填写该服务实际支持的名称。</small></label>
      {reasoning && <ReasoningParameters value={{ ...parameters, model: models.split(',').map(value => value.trim()).includes(parameters.model)
          ? parameters.model : models.split(',')[0]?.trim() || '' }}
        models={models.split(',').map(value => value.trim()).filter(Boolean)}
        efforts={reasoning.efforts} onChange={setParameters} />}
      <label className="provider-proxy">代理地址<input value={proxy} spellCheck={false} maxLength={1024}
        placeholder="http://127.0.0.1:代理端口" onChange={event => setProxy(event.target.value)} />
        <small>远程服务必须配置 HTTP、HTTPS 或 SOCKS 代理，连接失败不会直连。
          {initial.proxy_auth_configured && ' 已保存的代理认证会在地址不变时保留。'}</small></label>
    </fieldset>
    <p className="dialog-note">当前来源：{initial.storage === 'system_keyring' ? '系统凭据存储' : '本地环境配置'}。
      保存后立即生效，并优先于 {kind === 'llm' ? '.env.gpt' : '.env.gpt-image2'}。关闭弹窗会清空未保存的密钥输入。</p>
    {clear && <p className="dialog-note">清除不会撤销服务商的密钥，也不会修改原有 .env 文件。</p>}
    {(save.error || test.error) && <p role="alert" className="palace-error">{save.error?.message || test.error?.message}</p>}
    {test.data && <p role="status" className="provider-test-result">{test.data.message}</p>}
    <div className="provider-actions">
      <button type="button" className="button outline" disabled={busy || clear || (changedOrigin && !reuse)}
        onClick={() => { save.reset(); test.mutate(input()); }}>{test.isPending && <LoaderCircle className="spin" size={14} />}测试连接</button>
      <button type="submit" className="button primary" disabled={busy || (changedOrigin && !reuse)}>
        {save.isPending && <LoaderCircle className="spin" size={14} />}{save.isPending ? '正在安全保存…' : '保存并应用'}</button>
    </div>
    <p className="dialog-note">测试仅查询模型列表，不会构思、生图或保存。系统凭据存储不可用时会报错，不会改存明文。</p>
  </form>;
}

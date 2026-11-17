import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Settings2 } from 'lucide-react';
import * as api from '../../api/palace';
import * as llm from '../../api/llm';
import { Modal } from '../../components/Modal';
import { ProviderForm } from './ProviderForm';

type Kind = 'image' | 'llm';
const kinds: Kind[] = ['image', 'llm'];
export function ProviderDialog({ initialKind = 'image' }: { initialKind?: Kind }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<Kind>(initialKind);
  const [busy, setBusy] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  function navigate(event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || busy) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'image' : event.key === 'End' ? 'llm' : tab === 'image' ? 'llm' : 'image';
    setTab(next); document.getElementById(`${id}-${next}-tab`)?.focus();
  }
  return <>
    <button ref={trigger} className="button secondary provider-settings-trigger" aria-label={initialKind === 'llm' ? 'LLM 设置' : '生图设置'}
      onClick={() => { setSaved(false); setOpen(true); }}>
      {saved ? <Check size={15} /> : <Settings2 size={15} />}<span>{saved ? '已保存' : initialKind === 'llm' ? 'LLM 设置' : '生图设置'}</span>
    </button>
    <Modal open={open} onOpenChange={setOpen} title={initialKind === 'llm' ? 'LLM 服务设置' : '生图服务设置'} returnFocus={trigger}>
      <div className="provider-tabs" role="tablist" aria-label="AI 服务类型">
        {kinds.map(kind => <button key={kind} id={`${id}-${kind}-tab`} type="button" role="tab"
          aria-selected={tab === kind} aria-controls={`${id}-${kind}-panel`}
          tabIndex={tab === kind ? 0 : -1} disabled={busy}
          onKeyDown={navigate} onClick={() => setTab(kind)}>{kind === 'image' ? '生图服务' : 'LLM · Responses'}</button>)}
      </div>
      <div role="tabpanel" id={`${id}-${tab}-panel`} aria-labelledby={`${id}-${tab}-tab`}>
        {open && <ProviderLoader key={tab} kind={tab} onBusy={setBusy}
          onSaved={() => { setSaved(true); setOpen(false); }} />}
      </div>
    </Modal>
  </>;
}
function ProviderLoader({ kind, onSaved, onBusy }: {
  kind: Kind; onSaved: () => void; onBusy: (busy: boolean) => void;
}) {
  const query = useQuery<api.ProviderSettings | llm.LlmProviderSettings>({ queryKey: ['provider-settings', kind],
    queryFn: ({ signal }) => kind === 'llm' ? llm.settings(signal) : api.providerSettings(signal),
    staleTime: 0, gcTime: 0, retry: false });
  if (query.error) return <div role="alert"><p>{query.error.message}</p>
    <button className="button outline" onClick={() => { void query.refetch(); }}>重新读取设置</button></div>;
  if (!query.data) return <p role="status">正在读取设置…</p>;
  return <ProviderForm key={query.data.write_token} kind={kind} initial={query.data} onSaved={onSaved} onBusy={onBusy} />;
}

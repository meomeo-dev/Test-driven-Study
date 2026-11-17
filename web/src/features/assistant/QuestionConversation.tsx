import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router';
import * as Dialog from '@radix-ui/react-dialog';
import { AssistantRuntimeProvider, useLocalRuntime } from '@assistant-ui/react';
import { Grip, History, Maximize2, Plus, X } from 'lucide-react';
import * as llm from '../../api/llm';
import * as api from '../../api/conversations';
import { detail } from '../../api/client';
import { ProviderDialog } from '../palace/ProviderDialog';
import { Conversation } from './Conversation';
import { ConversationHistory } from './ConversationHistory';
import { questionAdapter, savedMessages } from './adapter';
import { useConversation } from './useConversation';
import type { WindowControls } from './useWindowGeometry';

type WindowProps = {
  questionID: number; open: boolean; onOpen: (value: boolean) => void;
  windowControls: WindowControls;
  launcherClassName: string; launcherContent: ReactNode;
};

function SessionRuntime({ record, onSettled, onStarted, children }: {
  record: api.ConversationRecord; onSettled: () => void; onStarted: () => void;
  children: ReactNode;
}) {
  const adapter = useMemo(() => questionAdapter(record.id, onSettled, onStarted),
    [record.id, onSettled, onStarted]);
  // Keep the runtime outside dialog content: closing the panel does not stop a reply.
  // Selecting a different session unmounts it and aborts the prior request.
  const runtime = useLocalRuntime(adapter, { initialMessages: savedMessages(record.messages) });
  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}

export default function QuestionConversation(props: WindowProps) {
  const session = useConversation(props.questionID, props.open);
  const [history, setHistory] = useState(false);
  const [selection, setSelection] = useState(0);
  const [selectionError, setSelectionError] = useState('');
  const client = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const info = useQuery({ queryKey: ['llm-info'], queryFn: ({ signal }) => llm.info(signal),
    enabled: props.open, retry: false, staleTime: 0 });
  async function select(item: api.ConversationSummary) {
    setSelectionError('');
    try {
      const record = await api.conversation(item.id);
      api.rememberConversation(item.question_id, item.id);
      client.setQueryData(['assistant-selection', item.question_id], record);
      client.setQueryData(['assistant-conversation', item.id], record);
      if (item.question_id !== props.questionID) {
        navigate(`${location.pathname}?subject=${item.subject_id}&question=${item.question_id}`);
      } else { session.select(record); setSelection(value => value + 1); }
      setHistory(false);
    } catch (error) { setSelectionError((error as Error).message); }
  }
  const body = <>
    {(session.error || selectionError) && <p role="alert" className="tutor-error">
      {selectionError || session.error?.message} <button onClick={session.retry}>重试</button></p>}
    {history && <ConversationHistory questionID={props.questionID} selected={session.record?.id}
      onSelect={item => void select(item)} onBack={() => setHistory(false)} />}
    <div className="tutor-session" hidden={history}>
      {session.record ? <>
        {session.record.active_turn_id && <p role="status" className="tutor-reply-note tutor-syncing">正在同步上一轮回复…</p>}
        <Conversation ready={!!info.data?.ready && !session.record.active_turn_id && !session.creating}
          searching={info.data?.web_search === 'required'} />
      </> : <p role="status" className="tutor-syncing">正在读取对话…</p>}
    </div>
  </>;
  const window = <AssistantWindow {...props} creating={session.creating}
    onNew={() => { session.fresh(); setHistory(false); }} onHistory={() => setHistory(value => !value)}>
    {body}
  </AssistantWindow>;
  const record = session.record;
  return record ? <SessionRuntime
    key={`${record.id}:${selection}:${record.active_turn_id ? record.revision : 'ready'}`}
    record={record} onSettled={session.settled} onStarted={session.started}>{window}</SessionRuntime> : window;
}

function AssistantWindow({ questionID, open, onOpen, onNew, onHistory, creating,
  windowControls, launcherClassName, launcherContent, children }: WindowProps & {
    onNew: () => void; onHistory: () => void; creating: boolean; children: ReactNode;
  }) {
  const descriptionID = useId();
  const panel = useRef<HTMLDivElement>(null);
  const info = useQuery({ queryKey: ['llm-info'], queryFn: ({ signal }) => llm.info(signal),
    enabled: open, retry: false, staleTime: 0 });
  const title = '学习助手';
  const question = useQuery({ queryKey: ['question', questionID],
    queryFn: ({ signal }) => detail(questionID, signal), enabled: open });
  return <Dialog.Root open={open} onOpenChange={onOpen} modal={false}>
      <Dialog.Trigger className={launcherClassName} aria-label={`询问本题 · ${title}`}>
        {launcherContent}
      </Dialog.Trigger>
      <Dialog.Portal><Dialog.Content ref={panel} className="tutor-panel"
        style={{ left: windowControls.geometry.x, top: windowControls.geometry.y,
          width: windowControls.geometry.width, height: windowControls.geometry.height }}
        aria-describedby={descriptionID}
        onOpenAutoFocus={event => {
          event.preventDefault(); panel.current?.querySelector('textarea')?.focus();
        }}
        onInteractOutside={event => event.preventDefault()} {...windowControls.pointer}>
        <header className="tutor-heading" tabIndex={0} role="group" aria-label="移动对话窗口"
          title="拖动标题栏移动，方向键微调，Shift 加方向键精调"
          onKeyDown={windowControls.moveKeys} onPointerDown={event => {
            if (!(event.target as Element).closest('button')) windowControls.startMove(event);
          }}>
          <div><Dialog.Title asChild><h2>{title} <span>AI</span></h2></Dialog.Title></div>
          <button className="icon-button" onClick={windowControls.reset} aria-label="恢复默认窗口" title="恢复默认窗口"><Maximize2 size={15} /></button>
          <button className="icon-button" onClick={onHistory} aria-label="历史对话" title="历史对话"><History size={16} /></button>
          <button className="icon-button" onClick={onNew} disabled={creating} aria-label="新建对话" title="新建对话（保留历史）"><Plus size={17} /></button>
          <button className="icon-button" onClick={() => onOpen(false)} aria-label="关闭对话"><X size={19} /></button>
        </header>
        <div className="tutor-context" id={descriptionID}>
          <span>当前题目 <b>#{questionID}</b></span>
          <p title={question.data?.question.title}>{question.data?.question.title ?? '正在读取本题…'}</p>
        </div>
        {info.error && <p role="alert" className="tutor-error">{info.error.message}</p>}
        {question.error && <p role="alert" className="tutor-error">{question.error.message}</p>}
        {info.data && !info.data.ready && <p role="alert" className="tutor-error">{info.data.message}</p>}
        {children}
        <footer className="tutor-footer"><span>AI 生成，仅供学习 · {info.data?.web_search === 'required' ? '联网搜索已开启' : '未联网核验'}</span>
          <ProviderDialog initialKind="llm" /></footer>
        <button className="tutor-resize-handle" aria-label="调整对话窗口大小"
          title="拖动调整大小，方向键微调，Shift 加方向键精调"
          onPointerDown={windowControls.startResize} onKeyDown={windowControls.resizeKeys}>
          <Grip size={13} />
        </button>
      </Dialog.Content></Dialog.Portal>
    </Dialog.Root>;
}

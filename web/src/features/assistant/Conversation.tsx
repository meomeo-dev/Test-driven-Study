import { AuiIf, ComposerPrimitive, MessagePrimitive, ThreadPrimitive,
  useAuiState, type SourceMessagePartProps } from '@assistant-ui/react';
import { ArrowUp, ExternalLink, LoaderCircle, Square } from 'lucide-react';
import { MarkdownContent } from './MarkdownContent';

function Source({ url, title }: SourceMessagePartProps) {
  if (!url) return <span>{title}</span>;
  return <a className="tutor-source" href={url} target="_blank" rel="noopener noreferrer">
    <ExternalLink size={12} />{title || new URL(url).hostname}
  </a>;
}

const assistantParts = { Source, Text: MarkdownContent };
const userParts = { Source };

function ReplyStatus() {
  const status = useAuiState(s => s.message.status);
  const searched = useAuiState(s => s.message.metadata.custom.searchUsed);
  if (status?.type === 'incomplete') {
    const error = status.error;
    const message = typeof error === 'object' && error && 'message' in error
      ? error.message : error;
    return <p className="tutor-error" role="alert">{typeof message === 'string'
      ? message : status.reason === 'cancelled' ? '已停止回复。' : '回复未完成，请手动重新提问。'}</p>;
  }
  return <AuiIf condition={s => s.message.status?.type === 'complete'}>
    <p className="tutor-reply-note">{searched
      ? '已检索参考资料 · 请结合原文核对' : '依据题库讲解 · 未联网核验'}</p>
  </AuiIf>;
}

export function Conversation({ ready, searching }: {
  ready: boolean; searching: boolean;
}) {
  const tutor = '学习助手';
  return <ThreadPrimitive.Root className="tutor-thread">
    <ThreadPrimitive.Viewport className="tutor-messages">
      <AuiIf condition={s => s.thread.isEmpty}>
        <div className="tutor-welcome">
          <span className="tutor-eyebrow">一起弄懂这道题</span>
          <h3>哪里还不太明白？</h3>
          <p>我会结合本题的题干、选项、配图和解析，陪你梳理思路。</p>
          <div className="tutor-suggestions">
            {['这道题为什么这样选？', '容易混淆的地方是什么？', '帮我想个记忆方法'].map(prompt =>
              <ThreadPrimitive.Suggestion key={prompt} prompt={prompt} send
                className="tutor-suggestion" disabled={!ready}>{prompt}<ArrowUp size={13} /></ThreadPrimitive.Suggestion>)}
          </div>
        </div>
      </AuiIf>
      <ThreadPrimitive.Messages>{({ message }) =>
        <MessagePrimitive.Root className={`tutor-message ${message.role}`}>
          <span className="tutor-speaker">{message.role === 'user' ? '你' : tutor}</span>
          <div className="tutor-bubble"><MessagePrimitive.Parts
            components={message.role === 'assistant' ? assistantParts : userParts} /></div>
          {message.role === 'assistant' && <ReplyStatus />}
        </MessagePrimitive.Root>}
      </ThreadPrimitive.Messages>
      <AuiIf condition={s => s.thread.isRunning}>
        <p className="tutor-running" role="status"><LoaderCircle size={14} className="spin" />
          {searching ? '正在分析并核对参考资料…' : '正在分析本题…'}</p>
      </AuiIf>
    </ThreadPrimitive.Viewport>
    <ComposerPrimitive.Root className="tutor-composer">
      <ComposerPrimitive.Input aria-label={`向${tutor}提问`} placeholder={ready ? '问问这道题，Enter 发送…' : '请先配置 LLM 服务'}
        maxLength={2000} rows={2} disabled={!ready} autoFocus />
      <div className="tutor-composer-actions"><span>Shift + Enter 换行</span>
        <AuiIf condition={s => !s.thread.isRunning}>
          <ComposerPrimitive.Send className="tutor-send" aria-label="发送问题" disabled={!ready}>
            <ArrowUp size={18} /></ComposerPrimitive.Send>
        </AuiIf>
        <AuiIf condition={s => s.thread.isRunning}>
          <ComposerPrimitive.Cancel className="tutor-send" aria-label="停止回复"><Square size={14} /></ComposerPrimitive.Cancel>
        </AuiIf>
      </div>
    </ComposerPrimitive.Root>
  </ThreadPrimitive.Root>;
}

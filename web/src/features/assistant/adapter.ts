import type { ChatModelAdapter, SourceMessagePart, ThreadMessageLike } from '@assistant-ui/react';
import { chat } from '../../api/chat';
import type { SavedChatMessage } from '../../api/conversations';

function sourceParts(sources: SavedChatMessage['sources']): SourceMessagePart[] {
  return (sources ?? []).map((source, index) => ({
    type: 'source', sourceType: 'url', id: String(index),
    url: source.url, title: source.title || new URL(source.url).hostname,
  }));
}

export function savedMessages(messages: SavedChatMessage[]): ThreadMessageLike[] {
  return messages.map(message => ({
    id: message.id, role: message.role, createdAt: new Date(message.created_at_ms),
    content: [{ type: 'text', text: message.text }, ...sourceParts(message.sources)],
    ...(message.role === 'assistant' ? {
      status: message.status === 'completed'
        ? { type: 'complete' as const, reason: 'stop' as const }
        : { type: 'incomplete' as const, reason: 'error' as const,
          error: { message: message.error || '正在同步上一轮回复，请稍候…' } },
    } : {}),
    metadata: { custom: { searchUsed: message.search_used } },
  }));
}

export function questionAdapter(conversationID: string, onSettled: () => void,
  onStarted: () => void): ChatModelAdapter {
  return {
    async *run({ messages, abortSignal }) {
      const latest = messages.filter(message => message.role === 'user').at(-1);
      const prompt = latest?.content.filter(part => part.type === 'text')
        .map(part => part.text).join('\n') ?? '';
      let text = '';
      try {
        for await (const event of chat({ id: crypto.randomUUID(), text: prompt }, abortSignal, conversationID)) {
          if (event.type === 'status') onStarted();
          if (event.type === 'delta') {
            text += event.text ?? '';
            yield { content: [{ type: 'text', text }] };
          }
          if (event.type === 'done') {
            yield {
              content: [{ type: 'text', text: event.text ?? text }, ...sourceParts(event.sources)],
              metadata: { custom: { searchUsed: !!event.search_used } },
            };
          }
        }
      } finally { onSettled(); }
    },
  };
}

import type { QuestionChatEvent, QuestionChatInput } from './generated/types.gen';
export type { QuestionChatEvent, QuestionChatInput } from './generated/types.gen';

export async function* chat(input: QuestionChatInput | { id: string; text: string },
  signal: AbortSignal, conversationID?: string) {
  const controller = new AbortController();
  const response = await fetch(conversationID ? `/api/llm/conversations/${conversationID}/messages` : '/api/llm/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input), signal: AbortSignal.any([signal, controller.signal]),
  });
  if (!response.ok) {
    const body = await response.json() as { error?: string };
    throw new Error(body.error ?? '对话暂时不可用，请稍后重新提问。');
  }
  if (!response.body) throw new Error('浏览器无法读取回复流。');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      if (buffer.length > 128_000) throw new Error('回复事件超过长度限制。');
      let newline = buffer.indexOf('\n');
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) {
          const event = JSON.parse(line) as QuestionChatEvent;
          if (event.type === 'error') throw new Error(event.text ?? '回复中断。');
          yield event;
          if (event.type === 'done') return;
        }
        newline = buffer.indexOf('\n');
      }
      if (done) throw new Error('连接中断，回复尚未完成，请手动重新提问。');
    }
  } finally {
    controller.abort();
    reader.releaseLock();
  }
}

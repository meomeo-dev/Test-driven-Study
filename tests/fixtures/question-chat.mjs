import { sendResponse } from './responses-stream.mjs';
import { markdownReply } from './chat-markdown.mjs';

export async function sendQuestionReply(res, body, events) {
  const source = JSON.stringify(body.input);
  const prompt = String(body.input.at(-1)?.content ?? '');
  events.push({ kind: 'chat', source, search: body.tool_choice === 'required',
    model: body.model, stream: body.stream, store: body.store,
    instructions: body.instructions,
    allowed_domains: body.tools?.find(tool => tool.type === 'web_search')?.filters?.allowed_domains });
  res.on('close', () => {
    if (!res.writableEnded) events.push({ kind: 'chat-aborted', source });
  });
  if (prompt.includes('chat-error-on-purpose')) {
    res.writeHead(402, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'PRIVATE-PROVIDER-DIAGNOSTIC' } }));
    return;
  }
  if (prompt.includes('chat-slow-on-purpose')) {
    await new Promise(resolve => setTimeout(resolve, 2500));
    if (res.destroyed) return;
  }
  const searched = body.tool_choice === 'required' && !prompt.includes('chat-unverified-on-purpose');
  const general = !body.tools?.find(tool => tool.type === 'web_search')?.filters;
  const url = general ? 'https://example.edu/fractions' : 'https://www.gov.cn/';
  const title = general ? '分数测试来源' : '官方测试来源';
  const output = searched ? [{ type: 'web_search_call', status: 'completed',
    action: { type: 'search', sources: [{ url, title }] } }] : [];
  const followup = body.input.filter(item => item.role === 'user').length > 2;
  output.push({ type: 'message', role: 'assistant', status: 'completed', content: [{
    type: 'output_text', text: prompt.includes('chat-markdown') ? markdownReply
      : followup ? '接着上一轮说明，判断时要先看题目中的适用条件。'
      : '先看本题的适用条件，再逐项排除容易混淆的选项。\n记忆方法：先判断情境，再判断规则。',
    annotations: searched ? [{ type: 'url_citation', url, title }] : [],
  }] });
  await sendResponse(res, prompt.includes('chat-json-on-purpose') ? { ...body, stream: false } : body,
    { status: 'completed', output,
    usage: { input_tokens: 400, output_tokens: 80, total_tokens: 480 } },
  source + (prompt.includes('chat-broken-on-purpose') ? ' broken-trace-fixture' : '')
    + (prompt.includes('chat-markdown-stream-on-purpose') ? ' stream-trace-fixture' : ''));
}

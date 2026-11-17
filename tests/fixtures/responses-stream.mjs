const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function sendResponse(res, body, result, source) {
  if (!body.stream || source.includes('batch-trace-fixture')) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result)); return;
  }
  const slow = source.includes('stream-trace-fixture');
  const escape = source.includes('trace-escape-fixture');
  result.output = result.output.map((item, index) => ({...item, id: `fixture-item-${index}`}));
  if (slow) result.output.unshift({id: 'fixture-summary', type: 'reasoning',
    encrypted_content: 'PRIVATE-OPAQUE-NEVER-TRACE',
    summary: [{type: 'summary_text', text: escape
      ? '公开摘要：核对规则。<img src=x onerror="window.traceInjected=true">'
      : '公开摘要：正在核对原题与官方交通规则，区分适用条件。'}]});
  res.setHeader('Content-Type', 'text/event-stream'); res.flushHeaders();
  const emit = event => {if (!res.destroyed) res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);};
  emit({type: 'response.created', response: {id: 'fixture-response'}});
  for (const [index, item] of result.output.entries()) {
    emit({type: 'response.output_item.added', output_index: index, item: {...item, status: 'in_progress', content: []}});
    if (item.type === 'web_search_call') {
      emit({type: 'response.web_search_call.in_progress', output_index: index, item_id: item.id});
      if (slow) await pause(350);
      emit({type: 'response.web_search_call.searching', output_index: index, item_id: item.id});
      if (slow) await pause(350);
      emit({type: 'response.web_search_call.completed', output_index: index, item_id: item.id});
    }
    if (item.type === 'reasoning') for (const [summaryIndex, summary] of (item.summary ?? []).entries()) {
      for (let offset = 0; offset < summary.text.length; offset += 16) {
        emit({type: 'response.reasoning_summary_text.delta', item_id: item.id,
          output_index: index, summary_index: summaryIndex, delta: summary.text.slice(offset, offset + 16)});
        if (slow) await pause(200);
      }
      emit({type: 'response.reasoning_summary_text.done', item_id: item.id,
        output_index: index, summary_index: summaryIndex, text: summary.text});
    }
    if (item.type === 'message') for (const [contentIndex, content] of item.content.entries()) {
      if (content.type !== 'output_text') continue;
      for (let offset = 0; offset < content.text.length; offset += 160) {
        emit({type: 'response.output_text.delta', item_id: item.id, output_index: index,
          content_index: contentIndex, delta: content.text.slice(offset, offset + 160)});
        if (source.includes('broken-trace-fixture')) {
          // Allow the complete SSE frame to reach the client before the
          // transport fails, so the fixture tests actual partial delivery.
          await pause(250); res.destroy(); return;
        }
        if (source.includes('chat-partial-on-purpose')) await pause(2000);
        if (slow) await pause(200);
      }
      emit({type: 'response.output_text.done', item_id: item.id, output_index: index,
        content_index: contentIndex, text: content.text});
    }
    emit({type: 'response.output_item.done', output_index: index, item});
  }
  emit({type: `response.${result.status}`, response: result}); res.end();
}

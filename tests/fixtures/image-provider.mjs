import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { sendResponse } from './responses-stream.mjs';
import { sendQuestionReply } from './question-chat.mjs';

// An isolated acceptance fixture. It never forwards requests to an AI service.
const events = [];
const failedOnce = new Set();
const data = readFileSync(new URL('../../courses/elementary-chinese/assets/textbook/bed.jpg', import.meta.url));
createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/test/events') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(events)); return; }
  if (req.method === 'GET' && req.url === '/health') {
    res.end('ok'); return;
  }
  if (req.method === 'GET' && req.url === '/v1/models') {
    const llm = req.headers.authorization === 'Bearer isolated-llm-fixture';
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ data: (llm ? ['fixture-reasoner', 'fixture-secondary'] : ['gpt-image-2']).map(id => ({ id })) })); return;
  }
  if (req.method === 'POST' && req.url === '/v1/responses/input_tokens') {
    for await (const chunk of req) void chunk;
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({input_tokens:1000}));return;
  }
  if (req.method === 'POST' && req.url === '/v1/responses/compact') {
    const chunks=[]; for await (const chunk of req) chunks.push(chunk);
    const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    events.push({kind:'compact',source:JSON.stringify(body.input)});
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({output:[body.input[0],{type:'compaction',encrypted_content:'fixture-opaque-state'},
      {role:'user',content:[{type:'input_text',text:'retained compact window tail'}]}],usage:{input_tokens:80,output_tokens:10,total_tokens:90}}));return;
  }
  if (req.method === 'POST' && req.url === '/v1/responses') {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const source=JSON.stringify(body.input);
    const searched=Array.isArray(body.tools) && body.tools.some(t=>t.type==='web_search');
    events.push({ kind:'llm', source, has_search:searched, format:body.text?.format?.type,
      instructions:body.instructions,
      has_gap:body.instructions?.includes('Unresolved evidence gap') });
    const format=body.text?.format;
    if (format?.type === 'json_schema' && format.name === 'written_feedback') {
      if (req.headers.authorization !== 'Bearer isolated-llm-fixture' || body.store !== false
        || format.strict !== true || format.schema?.additionalProperties !== false
        || !Number.isInteger(body.max_output_tokens)
        || body.tools || body.stream || typeof body.input !== 'string') {
        res.writeHead(400).end(); return;
      }
      const evidence = JSON.parse(body.input);
      if (evidence.question?.type !== 'writing' || !evidence.submission?.text ||
        evidence.question.sample_response !== 'The delivery has been moved to Friday.') {
        res.writeHead(400).end(); return;
      }
      const criteria = Object.entries(evidence.rubric).map(([name, max_points]) =>
        ({ name, max_points, points: max_points, comment: '满足评分要求。' }));
      const text = JSON.stringify({ criteria, summary: '表达清楚，符合通知语境。' });
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'completed', output: [{ type: 'message', role: 'assistant',
        status: 'completed', content: [{ type: 'output_text', text }] }] }));
      return;
    }
    if (req.headers.authorization !== 'Bearer isolated-llm-fixture' || body.store !== false
      || !['json_schema','text'].includes(format?.type) || (format.type==='json_schema' && format.strict !== true) || !Number.isInteger(body.max_output_tokens)
      || !Array.isArray(body.input)) {
      res.writeHead(400).end();return;
    }
    if (body.instructions?.startsWith('Explain the current question and answer')) {
      await sendQuestionReply(res, body, events); return;
    }
    const recovering=source.includes('recover-research-fixture');
    const assessed=body.input.some(item=>Array.isArray(item.content) && item.content.some(part=>{
      try { return JSON.parse(part.text).research?.status==='insufficient'; } catch { return false; }
    }));
    await new Promise(resolve => setTimeout(resolve,
      recovering && assessed && searched && source.includes('cancel-supplement') ? 6000
      : recovering && assessed && searched && source.includes('pause-global') ? 6000
      : source.includes('slow-planning') ? 4000
      : recovering && assessed && searched ? 2400 : 400));
    res.setHeader('Content-Type','application/json');
    const listening = source.includes('ielts-transcript-research-fixture');
    const math = source.includes('math-model-fixture');
    const sourceURL = math ? 'https://example.test/math/equal-parts'
      : listening ? 'https://example.test/ielts/listening' : 'https://www.gov.cn/';
    const sourceTitle = math ? '等分教学测试来源'
      : listening ? '听力教学测试来源' : '政府测试来源（fixture）';
    const output=searched ? [{type:'web_search_call',status:'completed',action:{type:'search',sources:[{url:sourceURL,title:sourceTitle}]}}] : [];
    if ((listening || math) && searched && format.type === 'text') {
      output.push({type:'message',role:'assistant',status:'completed',content:[{type:'output_text',
        text:math?'检索资料支持用四个等份表示整体，其中一份为 1/4。':
          '检索资料支持听清说话人如何纠正先前的信息。',
        annotations:[{type:'url_citation',url:sourceURL,title:sourceTitle}]}]});
      await sendResponse(res,body,{status:'completed',output,
        usage:{input_tokens:400,output_tokens:500,total_tokens:900}},source);return;
    }
    if (source.includes('compact-on-purpose') && !body.input.some(i=>i.type==='compaction')) {
      output.push({type:'reasoning',encrypted_content:'fixture-encrypted-reasoning',summary:[]});
      await sendResponse(res,body,{status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output,
        usage:{input_tokens:400,output_tokens:body.max_output_tokens,total_tokens:400+body.max_output_tokens}},source);return;
    }
    const originalURL='https://www.gov.cn/fixture-primary';
    if (recovering && assessed && searched) {
      output.push({type:'web_search_call',status:'completed',action:{type:'open_page',url:originalURL}},
        {type:'web_search_call',status:'completed',action:{type:'find_in_page',url:originalURL,pattern:'适用条件'}},
        {type:'message',role:'assistant',status:'completed',content:[{type:'output_text',
          text:'补充阅读官方原文，已找到此前缺失的适用条件。',
          annotations:[{type:'url_citation',url:originalURL,title:'补充原文（fixture）'}]}]});
      await sendResponse(res,body,{status:'completed',output,usage:{input_tokens:400,output_tokens:500,total_tokens:900}},source);return;
    }
    const transcriptEvidence = source.includes('But do bring the bike you normally ride')
      && body.instructions?.includes('A missing external copy is not an evidence gap.');
    const unverified=body.model==='fixture-secondary' || (recovering && !assessed)
      || (listening && !transcriptEvidence);
    const disabled=body.instructions?.includes('Search is explicitly disabled');
    let scene = {
      title:'红灯入口',scene:'在记忆宫殿的红灯入口停车等待。',
      anchors:[{cue:'红灯',meaning:'停车等待'}],pitfalls:['不要把加速通过当成正确答案'],
      image_prompt:'记忆宫殿红灯入口：保持原题正确答案，红灯前停车等待，禁止加速通过。',
    };
    if (listening) {
      scene = {title:'工坊里的两件必带物品', scene:'自行车和水瓶同在一个工坊，回忆参加者需要带什么。',
        anchors:[{cue:'自行车旁的一瓶水',meaning:'这两件东西需要参加者自带'}],
        pitfalls:['工具由主办方提供'], image_prompt:'正确答案用自行车和水瓶作为画面线索。'};
    } else if (math) {
      scene = {title:'四分之一',scene:'整体等分为四格，着色一格。遮住算式后辨认所占比例。',
        anchors:[{cue:'四等份中着色一份',meaning:'1/4 = 0.25'}],
        pitfalls:['四等份必须同宽'],
        image_prompt:'记忆宫殿画一条四个同宽格的条带，左侧一格着色。正确答案标注 1/4 = 0.25。'};
    }
    output.push({type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify({
      ...scene,
      research:{status:disabled?'not_requested':unverified?'insufficient':'supported',
        explanation:listening && unverified?'缺少同题的外部录音或答案键。':'此处为本地测试研究结果。',
        sources:unverified||disabled?[]:[{url:recovering?originalURL:sourceURL,title:sourceTitle,claim:'测试教学规则'}]},
    }),annotations:disabled?[]:[{type:'url_citation',url:sourceURL,title:sourceTitle}]}]});
    await sendResponse(res,body,{status:'completed',output,usage:{input_tokens:400,output_tokens:500,total_tokens:900}},source);return;
  }
  if (req.method !== 'POST'  || !['/v1/images/generations', '/v1/images/edits'].includes(req.url)) {
    res.writeHead(404).end(); return;
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 12 * 1024 * 1024) { res.writeHead(413).end(); return; }
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString('utf8');
  events.push({ kind:'image', source:body });
  if (req.headers.authorization !== 'Bearer isolated-browser-fixture'
    || !body.includes('记忆宫殿') || !body.includes('正确')) {
    res.writeHead(400).end(); return;
  }
  await new Promise(resolve => setTimeout(resolve, body.includes('slow-on-purpose') ? 5000 : 1000));
  res.setHeader('Content-Type', 'application/json');
  if (body.includes('fail-on-purpose')) {
    res.writeHead(422).end(JSON.stringify({ error: 'fixture failure' })); return;
  }
  if (body.includes('retry-image-fail-once') && !failedOnce.has('retry-image-fail-once')) {
    failedOnce.add('retry-image-fail-once');
    res.writeHead(422).end(JSON.stringify({error:'isolated first image failure'})); return;
  }
  res.end(JSON.stringify({ data: [{ b64_json: data.toString('base64') }],
    usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 } }));
}).listen(43289, '127.0.0.1');

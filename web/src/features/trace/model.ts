import type { TraceEvent } from '../../api/generated/types.gen';
export type { TraceEvent } from '../../api/generated/types.gen';

export type TraceEntry = {
  id: string; parent: string; kind: string; label: string; status: string;
  start: number; end?: number; content: string; details: string; instant: boolean;
  batch: boolean; unknownEnd: boolean; depth: number;
};

export function entriesFrom(events: TraceEvent[], active: boolean): TraceEntry[] {
  const entries = new Map<string, TraceEntry>();
  for (const event of [...events].sort((a, b) => a.id - b.id)) {
    let entry = entries.get(event.span_id);
    if (!entry) {
      entry = {id: event.span_id, parent: event.parent_id, kind: event.kind,
        label: event.label, status: event.status, start: event.observed_at_ms,
        content: '', details: '', instant: event.type === 'note', batch: false,
        unknownEnd: false, depth: 0};
      entries.set(entry.id, entry);
    }
    if (event.type === 'delta') entry.content += event.content;
    if (event.type === 'note') entry.content = event.content;
    if (event.type === 'end' || event.type === 'note') {
      entry.end = Math.max(entry.start, event.observed_at_ms);
      entry.status = event.status; entry.details = event.content;
    }
    entry.batch ||= event.origin === 'response' || event.content.includes('整轮返回') ||
      event.content.includes('未测得独立执行区间');
  }
  for (const entry of entries.values()) {
    let parent = entries.get(entry.parent);
    const visited = new Set([entry.id]);
    while (parent && !visited.has(parent.id) && entry.depth < 6) {
      entry.depth++; visited.add(parent.id); parent = entries.get(parent.parent);
    }
    if (entry.end === undefined && !active) {
      entry.unknownEnd = true; entry.status = 'unknown';
    }
  }
  return [...entries.values()];
}

export function duration(ms: number) {
  const seconds = Math.max(0, ms) / 1000;
  return seconds < 60 ? `${seconds.toFixed(1)}s`
    : `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
}
export function entryStatus(status: string) {
  return ({running: '进行中', completed: '已完成', failed: '失败', incomplete: '未完成',
    canceled: '已终止', paused: '已暂停', interrupted: '中断', unknown: '结束时间未知'} as Record<string, string>)[status] || status;
}
export const kindNames: Record<string, string> = {pipeline: '调度', llm: '模型', tool: '工具',
  reasoning: '思考摘要', answer: '回答', image: '生图', storage: '保存', source: '来源',
  usage: '用量', scheduler: '调度', validation: '上下文', compaction: '压缩', arguments: '参数准备'};

export function officialLink(text: string) {
  try {
    const url = new URL(text.trim());
    if (url.protocol === 'https:' && !url.username && !url.password &&
      (!url.port || url.port === '443') && (url.hostname === 'gov.cn' || url.hostname.endsWith('.gov.cn'))) return url.href;
  } catch { return; }
}

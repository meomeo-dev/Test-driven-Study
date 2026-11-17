import { useEffect, useRef, useState } from 'react';
import { request } from '../../api/client';
import type { PalaceJob, TracePage } from '../../api/generated/types.gen';
import type { TraceEvent } from './model';

export function useTaskTrace(job: PalaceJob) {
  const cache = useRef({id: '', cursor: 0, events: new Map<number, TraceEvent>()});
  const [state, setState] = useState({id: '', events: [] as TraceEvent[],
    connection: 'connecting', limited: false, error: ''});
  useEffect(() => {
    const controller = new AbortController();
    let stream: EventSource | undefined;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    if (cache.current.id !== job.id) cache.current = {id: job.id, cursor: 0, events: new Map()};
    const saved = cache.current;
    const base = `/api/palaces/jobs/${encodeURIComponent(job.id)}/trace`;
    function update(connection: string, error = '', limited = false) {
      if (disposed) return;
      setState(previous => ({id: job.id, events: [...saved.events.values()], connection,
        error, limited: limited || (previous.id === job.id && previous.limited)}));
    }
    function append(event: TraceEvent) {
      if (!Number.isSafeInteger(event.id) || event.id <= 0 ||
        typeof event.span_id !== 'string' || typeof event.content !== 'string') return;
      saved.events.set(event.id, event); saved.cursor = Math.max(saved.cursor, event.id);
    }
    async function catchUp() {
      let page: TracePage;
      do {
        page = await request<TracePage>(`${base}?after=${saved.cursor}`, {signal: controller.signal});
        if (disposed) return;
        page.events.forEach(append); update('connecting', '', page.limited);
      } while (page.has_more);
    }
    async function connect() {
      try {
        await catchUp(); if (disposed) return;
        stream = new EventSource(`${base}/stream?after=${saved.cursor}`);
        stream.onopen = () => update('live');
        stream.addEventListener('trace', event => {
          try { append(JSON.parse((event as MessageEvent).data)); update('live'); }
          catch { update('reconnecting', '轨迹事件无法解析，可刷新重新读取。'); }
        });
        stream.addEventListener('settled', () => {
          stream?.close();
          void catchUp().then(() => update('settled')).catch(error => {
            if (!disposed) {
              update('reconnecting', error.message);
              reconnect = setTimeout(() => { void connect(); }, 2000);
            }
          });
        });
        stream.onerror = () => update('reconnecting', '轨迹连接中断，正在续接；后台任务不受影响。');
      } catch (error) {
        if (!disposed) {
          update('reconnecting', error instanceof Error ? error.message : '轨迹读取失败');
          reconnect = setTimeout(() => { void connect(); }, 2000);
        }
      }
    }
    update('connecting'); void connect();
    return () => { disposed = true; controller.abort(); stream?.close(); clearTimeout(reconnect); };
  }, [job.id, job.status, job.updated_at_ms]);
  return state.id === job.id ? state : {id: job.id, events: [], connection: 'connecting', limited: false, error: ''};
}

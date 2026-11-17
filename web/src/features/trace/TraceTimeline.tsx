import type { TraceEntry } from './model';
import { duration, entryStatus } from './model';

export function TraceTimeline({entries, now, onSelect, selected}: {
  entries: TraceEntry[]; now: number; selected: string; onSelect: (id: string) => void;
}) {
  const spans = entries.filter(entry => !entry.instant);
  const start = spans.length ? Math.min(...spans.map(span => span.start)) : now;
  const latest = Math.max(start + 1000, ...spans.map(span => span.end ?? (span.unknownEnd ? span.start : now)));
  const total = latest - start;
  return <section className="trace-timeline" aria-label="执行轨迹甘特图">
    <header><b>时间轴</b><span>0s</span><span>{duration(total)}</span></header>
    <div className="trace-time-rows">{spans.length ? spans.map(span => {
      const end = span.end ?? (span.unknownEnd ? span.start : now);
      const left = Math.max(0, (span.start - start) / total * 100);
      const width = Math.max(.6, (end - span.start) / total * 100);
      const elapsed = span.unknownEnd ? '结束时间未知' : span.batch ? '结果返回，未测耗时' : duration(end - span.start);
      const label = `${span.label} · ${entryStatus(span.status)} · ${elapsed}`;
      return <button key={span.id} className="trace-time-row" aria-label={label}
        aria-pressed={selected === span.id} onClick={() => onSelect(span.id)} data-kind={span.kind}
        data-state={span.status}>
        <span className="trace-time-label" style={{paddingLeft: `${Math.min(span.depth, 3) * 7}px`}} title={span.label}>{span.label}</span>
        <span className="trace-time-track"><span className="trace-time-bar" style={{left: `${left}%`, width: `${Math.min(width, 100 - left)}%`}} /></span>
        <small>{span.unknownEnd ? '?' : span.batch ? '返回点' : duration(end - span.start)}</small>
      </button>;
    }) : <p className="trace-empty">等待记录实际执行区间…</p>}</div>
  </section>;
}

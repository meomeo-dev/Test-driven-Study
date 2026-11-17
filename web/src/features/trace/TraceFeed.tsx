import { useEffect, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { entryStatus, kindNames, officialLink, type TraceEntry } from './model';

export function TraceFeed({entries, selected}: {
  entries: TraceEntry[]; selected: string;
}) {
  const [filter, setFilter] = useState('all');
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const [follow, setFollow] = useState(true);
  const scroll = useRef<HTMLDivElement>(null);
  const rows = useRef(new Map<string, HTMLDetailsElement>());
  const visible = entries.filter(entry => entry.kind !== 'pipeline' &&
    (filter === 'all' || entry.kind === filter || (filter === 'tool' && ['source', 'arguments'].includes(entry.kind))));
  useEffect(() => {
    if (follow && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [entries, follow]);
  useEffect(() => {
    if (!selected) return;
    setFilter('all'); setFollow(false); setOpened(value => ({...value, [selected]: true}));
    const row = rows.current.get(selected);
    if (row && scroll.current) scroll.current.scrollTop += row.offsetTop - scroll.current.offsetTop - scroll.current.scrollTop;
  }, [selected]);
  return <section className="trace-flow" aria-label="调度与输出流水">
    <header><b>执行流水</b><nav aria-label="轨迹类型筛选">
      {([['all', '全部'], ['reasoning', '思考摘要'], ['tool', '工具'], ['answer', '回答']] as const).map(([value, title]) =>
        <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{title}</button>)}
    </nav></header>
    <div className="trace-feed" ref={scroll} onScroll={event => {
      const node = event.currentTarget;
      if (node.scrollHeight - node.scrollTop - node.clientHeight > 40) setFollow(false);
    }}>
      {visible.map(entry => <details key={entry.id} ref={node => {if (node) rows.current.set(entry.id, node); else rows.current.delete(entry.id);}}
        className="trace-entry" data-kind={entry.kind} data-state={entry.status}
        data-selected={entry.id === selected} open={opened[entry.id] ?? ['answer', 'reasoning'].includes(entry.kind)}
        onToggle={event => {
          const open = event.currentTarget.open;
          setOpened(value => value[entry.id] === open ? value : {...value, [entry.id]: open});
        }}>
        <summary><span className="trace-kind">{kindNames[entry.kind] || '活动'}</span>
          <b>{entry.label}</b><small>{entryStatus(entry.status)}</small></summary>
        <div className="trace-entry-content">
          <time dateTime={new Date(entry.start).toISOString()}>{new Date(entry.start).toLocaleTimeString()}</time>
          {entry.content ? <TraceText entry={entry} /> : <p>{entry.kind === 'llm'
            ? entry.status === 'running' ? '等待模型响应；请求区间包含网络与服务端处理。'
              : '请求已结束，返回内容见相关回答、摘要和工具记录。'
            : '未返回可公开展示的文本。'}</p>}
          {entry.details && entry.details !== entry.content && <small>{entry.details}</small>}
          {entry.batch && <small>此项为返回时观察到的结果，未测得独立执行耗时。</small>}
          {entry.unknownEnd && <small>未收到结束事件，无法确定结束时间。</small>}
        </div>
      </details>)}
      {visible.length === 0 && <p className="trace-empty">{filter === 'reasoning'
        ? '供应商尚未返回公开思考摘要；隐藏推理与加密状态不会展示。' : '尚无此类事件。'}</p>}
    </div>
    {!follow && <button className="trace-follow" onClick={() => setFollow(true)}><ArrowDown size={12} />回到最新</button>}
  </section>;
}

function TraceText({entry}: {entry: TraceEntry}) {
  if (entry.kind === 'answer') {
    try {
      const value = JSON.parse(entry.content);
      if (typeof value.scene === 'string' && typeof value.title === 'string') return <div className="trace-answer">
        <b>{value.title}</b><p>{value.scene}</p>
        {typeof value.research?.explanation === 'string' && <p>{value.research.explanation}</p>}
        <details><summary>结构化回答原文</summary><pre>{JSON.stringify(value, null, 2)}</pre></details>
      </div>;
    } catch { /* Incomplete JSON remains literal streamed text until complete. */ }
  }
  return <pre>{entry.content.split('\n').map((line, index) => {
    const link = entry.kind === 'source' ? officialLink(line) : undefined;
    return <span key={index}>{link ? <a href={link} target="_blank" rel="noopener noreferrer">{line}</a> : line}{'\n'}</span>;
  })}</pre>;
}

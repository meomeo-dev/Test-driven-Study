import { useId, useLayoutEffect, useRef, useState } from 'react';
import { LocateFixed, Image, MessageCircle } from 'lucide-react';
import type { Summary } from '../../api/client';
import { stateLabel } from './model';
import { blockedKeyEvent } from './shortcuts';

const indexStep = 100;
const gridColumns = 6;
type Props = {
  rows: Summary[];
  current: number;
  onSelect: (id: number) => void;
  palaces?: ReadonlySet<number>;
  conversations?: ReadonlySet<number>;
};

export function QuestionNavigator({ rows, current, onSelect, palaces, conversations }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<number, HTMLButtonElement>());
  const [focused, setFocused] = useState(current);
  const gridId = useId();
  const position = rows.findIndex(row => row.question_id === current) + 1;
  const currentPoint = position === rows.length ? rows.length
    : position < indexStep ? 1 : Math.floor(position / indexStep) * indexStep;
  const points = rows.length ? [1] : [];
  for (let point = indexStep; point <= rows.length; point += indexStep) {
    points.push(point);
  }
  if (rows.length > 1 && points.at(-1) !== rows.length) points.push(rows.length);

  function scrollToQuestion(id: number, align: 'start' | 'nearest' | 'center' = 'center') {
    const list = viewport.current;
    const button = buttons.current.get(id);
    if (!list || !button) return;
    // Move only the local list; scrollIntoView could move outer ancestors too.
    const top = button.getBoundingClientRect().top
      - list.getBoundingClientRect().top + list.scrollTop;
    const bottom = top + button.offsetHeight;
    const visibleBottom = list.scrollTop + list.clientHeight;
    const target = align === 'start' ? top
      : align === 'center' ? top - (list.clientHeight - button.offsetHeight) / 2
      : top < list.scrollTop ? top
      : bottom > visibleBottom ? bottom - list.clientHeight : list.scrollTop;
    list.scrollTo({ top: Math.max(0, Math.min(list.scrollHeight - list.clientHeight, target)) });
  }
  useLayoutEffect(() => {
    setFocused(current);
    scrollToQuestion(current);
  }, [current, rows]);

  function locateCurrent() {
    scrollToQuestion(current);
    buttons.current.get(current)?.focus({ preventScroll: true });
  }

  function moveFocus(key: string, index: number) {
    const offsets: Record<string, number> = {
      ArrowLeft: -1, ArrowRight: 1, ArrowUp: -gridColumns, ArrowDown: gridColumns,
    };
    const next = key === 'Home' ? 0 : key === 'End' ? rows.length - 1
      : Math.max(0, Math.min(rows.length - 1, index + (offsets[key] ?? 0)));
    const target = rows[next];
    if (!target) return;
    buttons.current.get(target.question_id)?.focus({ preventScroll: true });
    scrollToQuestion(target.question_id, 'nearest');
  }

  return <section className="question-navigator" aria-label="连续题目导航">
    <div className="navigation-summary">
      <span className="navigation-current">
        <strong>当前题 #{position ? current : '—'}</strong>
        <small>{rows.length} 题 · 当前第 {position || '—'} 题</small>
      </span>
      <button type="button" className="inline-action" disabled={!position}
        onClick={locateCurrent}><LocateFixed size={13} />定位当前题</button>
    </div>
    <div className="navigation-legend">
      {palaces && <span><Image size={12} />有记忆画面</span>}
      {conversations && <span><MessageCircle size={12} />有对话记录</span>}
      <span><i />未学习</span><span><i className="mastered" />已记住</span>
      <span><i className="review" />待复习</span>
    </div>
    <div className="navigation-browser">
      <div ref={viewport} className="question-waterfall" aria-label="连续题号列表">
        <div className="question-grid" id={gridId}>
          {rows.map((row, index) => <button type="button" key={row.question_id}
            ref={button => {
              if (button) buttons.current.set(row.question_id, button);
              else buttons.current.delete(row.question_id);
            }}
            data-question-id={row.question_id} data-position={index + 1}
            tabIndex={focused === row.question_id ? 0 : -1}
            onFocus={() => setFocused(row.question_id)}
            onKeyDown={event => {
              if (blockedKeyEvent(event.nativeEvent)) return;
              if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                moveFocus(event.key, index);
              }
            }}
            data-has-conversation={conversations?.has(row.question_id) ? 'true' : undefined}
            data-has-palace={palaces?.has(row.question_id) ? 'true' : undefined}
            className={`grid-question ${palaces?.has(row.question_id) ? 'has-palace' : ''} ${conversations?.has(row.question_id) ? 'has-conversation' : ''} ${row.state} ${row.question_id === current ? 'current' : ''}`}
            aria-label={`第${index + 1}题，原题号${row.source_item_id || row.question_id}，${stateLabel(row.state)}${palaces?.has(row.question_id) ? '，有记忆画面' : ''}${conversations?.has(row.question_id) ? '，有对话记录' : ''}`}
            aria-current={row.question_id === current ? 'true' : undefined}
            title={`#${row.source_item_id || row.question_id} ${row.title}`}
            onClick={() => onSelect(row.question_id)}>
            <span className="grid-position">{index + 1}</span>
            <small className="grid-original-id">#{row.source_item_id || row.question_id}</small>
            <span className="grid-resource-indicators" aria-hidden="true">
              {palaces?.has(row.question_id) && <Image className="grid-palace-indicator" size={11} />}
              {conversations?.has(row.question_id) && <MessageCircle className="grid-conversation-indicator" size={11} />}
            </span>
          </button>)}
        </div>
        {rows.length === 0 && <p className="empty-navigation">没有符合条件的题目</p>}
      </div>
      <nav className="question-index" aria-label="每100题快速索引">
        {points.map(point => <button type="button" key={point}
          aria-label={`跳到第${point}题`} aria-controls={gridId}
          data-current={point === currentPoint ? 'true' : undefined}
          onClick={() => {
            const row = rows[point - 1];
            if (row) scrollToQuestion(row.question_id, 'start');
          }}>
          <i aria-hidden="true" /><span>{point}</span>
        </button>)}
      </nav>
    </div>
  </section>;
}

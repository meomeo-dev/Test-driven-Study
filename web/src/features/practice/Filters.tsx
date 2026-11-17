import { useEffect, useState, type Ref } from 'react';
import { ListFilter, Search, Waypoints, X } from 'lucide-react';
import type { Filters as FilterValues, Overview } from '../../api/practice';

type SearchProps = {
  value: string;
  onChange: (value: string) => void;
  inputRef: Ref<HTMLInputElement>;
  onExit: () => void;
  shortcuts: boolean;
};
type Props = {
  filters: FilterValues;
  chapters: Overview['chapters'];
  onChange: (key: string, value: string) => void;
  searchRef: Ref<HTMLInputElement>;
  onSearchExit: () => void;
  shortcuts: boolean;
  conceptTitle?: string;
};

function SearchField({ value, onChange, inputRef, onExit, shortcuts }: SearchProps) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (text === value) return;
    const timer = window.setTimeout(() => onChange(text), 300);
    return () => window.clearTimeout(timer);
  }, [text, value, onChange]);
  return <div className="search-field"><Search size={17} />
    <input ref={inputRef} aria-keyshortcuts={shortcuts ? '/' : undefined}
      onKeyDown={event => {
        if (event.key !== 'Escape' || event.nativeEvent.isComposing
            || event.nativeEvent.keyCode === 229) return;
        event.preventDefault();
        onExit();
      }}
      aria-label="搜索题干或题号" placeholder="搜索题干或题号" value={text}
      maxLength={200} onChange={event => setText(event.target.value)} />
    {text && <button type="button" aria-label="清空搜索" onClick={() => setText('')}><X size={15} /></button>}
  </div>;
}

export function Filters({ filters, chapters, onChange, searchRef, onSearchExit, shortcuts, conceptTitle }: Props) {
  return <section className="filter-toolbar" aria-label="筛选题目">
    {filters.concept && <button type="button" className="concept-chip"
      aria-label={`取消知识点筛选：${conceptTitle ?? filters.concept}`} onClick={() => onChange('concept', '')}>
      <Waypoints size={14} />知识点：{conceptTitle ?? filters.concept}<X size={13} /></button>}
    <select aria-label="选择章节" value={filters.chapter} onChange={event => onChange('chapter', event.target.value)}>
      <option value="">全部章节</option>
      {chapters.map(chapter => <option key={chapter.chapter_id} value={String(chapter.chapter_id)}>
        {chapter.chapter_name.trim()} · {chapter.total}题
      </option>)}
    </select>
    <select aria-label="学习状态" value={filters.state} onChange={event => onChange('state', event.target.value)}>
      <option value="all">全部题目</option><option value="unanswered">未作答</option>
      <option value="review">错题本</option>
      <option value="incorrect">最近答错</option><option value="correct">最近答对</option>
    </select>
    <SearchField shortcuts={shortcuts} inputRef={searchRef} onExit={onSearchExit}
      value={filters.search} onChange={value => onChange('q', value)} />
    <span className="order-label"><ListFilter size={16} />{filters.state === 'review' ? '易错分顺序' : '题库顺序'}</span>
  </section>;
}

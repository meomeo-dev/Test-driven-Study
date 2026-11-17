import { useRef } from 'react';

type Item = { id: string; label: string };
type Props = {
  prefix: string;
  label: string;
  items: readonly Item[];
  value: string;
  onChange: (value: string) => void;
};

export function Tabs({ prefix, label, items, value, onChange }: Props) {
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});
  function move(key: string) {
    const index = items.findIndex(item => item.id === value);
    const target = key === 'Home' ? 0 : key === 'End' ? items.length - 1
      : (index + (key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
    const item = items[target];
    if (!item) return;
    onChange(item.id);
    buttons.current[item.id]?.focus();
  }
  return <div className="compact-tabs" role="tablist" aria-label={label}>
    {items.map(item => <button key={item.id} type="button" role="tab"
      ref={element => { buttons.current[item.id] = element; }}
      id={`${prefix}-tab-${item.id}`} aria-controls={`${prefix}-panel-${item.id}`}
      aria-selected={value === item.id} tabIndex={value === item.id ? 0 : -1}
      onClick={() => onChange(item.id)} onKeyDown={event => {
        if (event.ctrlKey || event.metaKey || event.altKey
            || event.nativeEvent.isComposing) return;
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          move(event.key);
        }
      }}>{item.label}</button>)}
  </div>;
}

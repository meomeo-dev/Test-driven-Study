import type { RefObject } from 'react';
import { Modal } from '../../components/Modal';
import { keyLabel, SHORTCUTS } from './shortcuts';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabled: boolean;
  onEnabled: (enabled: boolean) => void;
  returnFocus: RefObject<HTMLElement | null>;
};
export function KeyboardHelp({ open, onOpenChange, enabled, onEnabled, returnFocus }: Props) {
  return <Modal open={open} onOpenChange={onOpenChange} title="快捷键" returnFocus={returnFocus}>
    <label className="shortcut-preference"><input type="checkbox" checked={enabled}
      onChange={event => onEnabled(event.target.checked)} />启用单键快捷键</label>
    <p className="dialog-note">
      关闭后仍可使用鼠标、Tab 和方向键。
      输入文字或中文输入法组合输入时，不触发全局操作。
    </p>
    {['Vim 风格导航', '应用操作'].map(group => <section key={group} className="shortcut-group">
      <h3>{group}</h3><dl>{SHORTCUTS.filter(item => item.group === group).map(item =>
        <div key={item.action}><dt>{item.keys.map(key => <kbd key={key}>{keyLabel(key)}</kbd>)}</dt><dd>{item.label}</dd></div>)}</dl>
    </section>)}
    <p className="dialog-note">
      导航参考 Vim；m / r / u / f / v / n / ? 是本应用映射。
      Tab 移动焦点，Enter / Space 保留控件的标准行为；
      Esc 关闭弹窗，搜索框内按 Esc 返回阅读区。
      ↑ / ↓ 滚动已显示的答案解析，也支持解析弹窗；长按可连续滚动。
    </p>
  </Modal>;
}

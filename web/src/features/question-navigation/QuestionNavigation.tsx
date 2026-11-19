import { useRef, useState, type Ref } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { PanelRightClose, PanelRightOpen, X } from 'lucide-react';
import { QuestionNavigator, type QuestionNavigatorProps } from './QuestionNavigator';

type Props = QuestionNavigatorProps & {
  shortcuts: boolean;
  triggerRef: Ref<HTMLButtonElement>;
};

export function QuestionNavigation({ shortcuts, triggerRef, onSelect, ...navigatorProps }: Props) {
  const [open, setOpen] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  return <Dialog.Root modal={false} open={open} onOpenChange={setOpen}>
    <Dialog.Trigger asChild>
      <button type="button" ref={triggerRef} className="button outline navigation-trigger"
        aria-label="题目导航" aria-keyshortcuts={shortcuts ? 'n' : undefined}>
        {open ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
        <span>题目导航</span>{shortcuts && <kbd aria-hidden="true">n</kbd>}
      </button>
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Content ref={content} className="navigation-drawer"
        onOpenAutoFocus={event => {
          event.preventDefault();
          const currentButton = content.current?.querySelector<HTMLButtonElement>(
            '.grid-question[aria-current="true"]',
          );
          (currentButton ?? content.current)?.focus({ preventScroll: true });
        }}>
        <header className="navigation-heading">
          <Dialog.Title>题目导航</Dialog.Title>
          <Dialog.Close className="icon-button" aria-label="收起题目导航">
            <X size={18} />
          </Dialog.Close>
        </header>
        <Dialog.Description className="sr-only">
          题号按当前筛选结果排序。格内上方为列表顺序，下方为原题号。
          百题索引用于滚动列表；定位当前题会居中并聚焦，选择题号后切题。
          使用方向键浏览题号，Enter 选择，Esc 收起导航。
        </Dialog.Description>
        <QuestionNavigator {...navigatorProps} onSelect={id => {
          onSelect(id);
          setOpen(false);
        }} />
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

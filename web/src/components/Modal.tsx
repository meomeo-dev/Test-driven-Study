import { useRef, type ReactNode, type RefObject } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  returnFocus: RefObject<HTMLElement | null>;
  children: ReactNode;
  wide?: boolean;
};

export function Modal({ open, onOpenChange, title, returnFocus, children, wide }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal><Dialog.Overlay className="image-overlay" />
      <Dialog.Content className={`study-dialog ${wide ? 'wide-dialog' : ''}`}
        aria-describedby={undefined}
        onOpenAutoFocus={event => {
          event.preventDefault();
          heading.current?.focus();
        }}
        onCloseAutoFocus={event => {
          event.preventDefault();
          if (returnFocus.current?.isConnected) {
            returnFocus.current.focus({ preventScroll: true });
            return;
          }
          document.querySelector<HTMLElement>('.reading-panel')?.focus();
        }}>
        <header className="modal-heading">
          <Dialog.Title ref={heading} tabIndex={-1}>{title}</Dialog.Title>
          <Dialog.Close className="icon-button" aria-label="关闭弹窗">
            <X size={20} />
          </Dialog.Close>
        </header>
        <div className="modal-body">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

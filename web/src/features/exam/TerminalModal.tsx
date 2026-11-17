import { useRef, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

export function TerminalModal({ title, children, onClose, wide = false }: {
  title: string; children: ReactNode; onClose: () => void; wide?: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal><Dialog.Overlay className="terminal-overlay"/>
      <Dialog.Content className={`terminal-dialog${wide ? ' terminal-dialog-wide' : ''}`}
        aria-describedby={undefined} onOpenAutoFocus={event => {
          event.preventDefault(); heading.current?.focus();
        }} onCloseAutoFocus={event => {
          event.preventDefault();
          document.querySelector<HTMLElement>(
            '.terminal-next:not(:disabled), .terminal-primary-actions .terminal-button:not(:disabled), .terminal-start',
          )?.focus();
        }}>
        <Dialog.Title ref={heading} tabIndex={-1}>{title}</Dialog.Title>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

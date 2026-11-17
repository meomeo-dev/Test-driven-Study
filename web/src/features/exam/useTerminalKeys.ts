import { useEffect } from 'react';
import { blockedKeyEvent } from '../practice/shortcuts';

export function useTerminalKeys({ enabled, choose, next, previous, help, card }: {
  enabled: boolean; choose: (position: number) => void; next: () => void;
  previous: () => void; help: () => void; card: () => void;
}) {
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (blockedKeyEvent(event) || event.repeat || document.querySelector('[role="dialog"]')) return;
      if (event.target instanceof Element &&
        event.target.closest('input,textarea,select,audio,.question-transcript,[contenteditable="true"]')) return;
      if (event.key === 'Enter' && event.target instanceof Element &&
        event.target.closest('button:not(.terminal-choice):not(.terminal-next)')) return;
      if (enabled && /^[1-4]$/.test(event.key)) {
        event.preventDefault(); choose(Number(event.key) - 1);
      } else if (event.key === 'Enter' || event.key === 'ArrowRight' || enabled && event.key === 'j') {
        event.preventDefault(); next();
      } else if (event.key === 'ArrowLeft' || enabled && event.key === 'k') {
        event.preventDefault(); previous();
      } else if (enabled && event.key === '?') {
        event.preventDefault(); help();
      } else if (enabled && event.key === 'n') {
        event.preventDefault(); card();
      }
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
}

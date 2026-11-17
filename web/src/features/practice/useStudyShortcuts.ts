import { useEffect, useRef, useState } from 'react';
import { blockedKeyEvent, SHORTCUTS, shortcutCommand, type ShortcutActions } from './shortcuts';
import { scrollExplanation } from '../../components/scrollExplanation';

const preferenceKey = 'test-driven-study.shortcuts';
export function useShortcutPreference() {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(preferenceKey) !== 'off'; }
    catch { return true; } // Storage can be unavailable; controls still work in memory.
  });
  function change(value: boolean) {
    setEnabled(value);
    try { localStorage.setItem(preferenceKey, value ? 'on' : 'off'); }
    catch (error) { console.warn('Shortcut preference could not be saved', error); }
  }
  return { enabled, change };
}

function editingTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  const selector = 'input, textarea, select, audio, .question-transcript, '
    + '[contenteditable]:not([contenteditable="false"]), '
    + '[role="tablist"], [role="combobox"], [role="menu"], [role="slider"]';
  return !!target.closest(selector);
}

export function useStudyShortcuts(enabled: boolean, actions: ShortcutActions) {
  const latest = useRef(actions);
  const prefix = useRef(0);
  useEffect(() => { latest.current = actions; }, [actions]);
  useEffect(() => {
    const reset = () => { prefix.current = 0; };
    function listener(event: KeyboardEvent) {
      if (event.key === 'Escape' || blockedKeyEvent(event) || editingTarget(event.target)) { reset(); return; }
      if (scrollExplanation(event) || document.querySelector('[role="dialog"]')) { reset(); return; }
      if (!enabled && !['ArrowLeft', 'ArrowRight', 'Enter'].includes(event.key)) { reset(); return; }
      if (event.key === 'Enter' && event.target instanceof Element
          && event.target.closest('button')
          && !event.target.closest('.choice-option, [data-practice-confirm]')) return;
      if (event.repeat && event.key === 'g') return;
      const command = shortcutCommand(event.key, Date.now() - prefix.current < 900);
      reset();
      if (!command) return;
      if (command === 'prefix') { prefix.current = Date.now(); event.preventDefault(); return; }
      const binding = SHORTCUTS.find(item => item.action === command);
      if (event.repeat && !binding?.repeat) { event.preventDefault(); return; }
      event.preventDefault(); latest.current[command]();
    }
    window.addEventListener('keydown', listener);
    window.addEventListener('focusin', reset);
    return () => {
      window.removeEventListener('keydown', listener);
      window.removeEventListener('focusin', reset);
    };
  }, [enabled]);
}

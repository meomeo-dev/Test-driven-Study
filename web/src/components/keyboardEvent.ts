export type ShortcutEvent = Pick<KeyboardEvent,
  'defaultPrevented' | 'ctrlKey' | 'metaKey' | 'altKey' | 'isComposing' | 'keyCode'>;

export function blockedKeyEvent(event: ShortcutEvent) {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return true;
  return event.isComposing || event.keyCode === 229;
}

const scrollStep = 48;

// Study shortcut handlers apply their input, IME, and modifier guards first.
export function scrollExplanation(event: KeyboardEvent) {
  if (event.shiftKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return false;
  const dialog = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]'))
    .filter(element => element.clientHeight > 0).at(-1);
  const viewport = dialog
    ? dialog.querySelector('.full-explanation')?.closest<HTMLElement>('.modal-body')
    : document.querySelector<HTMLElement>('.question-explanation-body');
  if (!viewport || viewport.clientHeight === 0
      || viewport.scrollHeight <= viewport.clientHeight + 1) return false;
  event.preventDefault();
  viewport.scrollBy({ top: event.key === 'ArrowDown' ? scrollStep : -scrollStep });
  return true;
}

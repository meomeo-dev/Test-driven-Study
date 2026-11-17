import type { KeyboardEvent, PointerEvent, RefObject } from 'react';
import { resizedWindow, viewportSize, type WindowGeometry } from './windowGeometry';

type Mode = 'move' | 'resize';
type Options = { current: RefObject<WindowGeometry>;
  update: (value: WindowGeometry) => void; save: () => void };
type Interaction = { pointer: number; x: number; y: number;
  origin: WindowGeometry; mode: Mode };
const directions: Record<string, { x: number; y: number }> = {
  ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
};

export function windowInteractions({ current, update, save }: Options) {
  let active: Interaction | undefined;
  function begin(event: PointerEvent<HTMLElement>, mode: Mode) {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    active = { pointer: event.pointerId, x: event.clientX, y: event.clientY,
      origin: current.current, mode };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<HTMLElement>) {
    if (!active || event.pointerId !== active.pointer) return;
    const delta = { x: event.clientX - active.x, y: event.clientY - active.y };
    update(active.mode === 'resize' ? resizedWindow(active.origin, delta, viewportSize())
      : { ...active.origin, x: active.origin.x + delta.x, y: active.origin.y + delta.y });
  }
  function finish(event: PointerEvent<HTMLElement>) {
    if (!active || event.pointerId !== active.pointer) return;
    active = undefined;
    save();
  }
  function keyboard(event: KeyboardEvent<HTMLElement>, mode: Mode) {
    const direction = directions[event.key];
    if (!direction || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const step = event.shiftKey ? 1 : 10;
    const delta = { x: direction.x * step, y: direction.y * step };
    update(mode === 'resize' ? resizedWindow(current.current, delta, viewportSize())
      : { ...current.current, x: current.current.x + delta.x, y: current.current.y + delta.y });
    save();
  }
  return {
    startMove: (event: PointerEvent<HTMLElement>) => begin(event, 'move'),
    startResize: (event: PointerEvent<HTMLElement>) => begin(event, 'resize'),
    moveKeys: (event: KeyboardEvent<HTMLElement>) => {
      if (event.target === event.currentTarget) keyboard(event, 'move');
    },
    resizeKeys: (event: KeyboardEvent<HTMLElement>) => keyboard(event, 'resize'),
    pointer: { onPointerMove: move, onPointerUp: finish, onPointerCancel: finish,
      onLostPointerCapture: finish },
  };
}

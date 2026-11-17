export type WindowGeometry = { x: number; y: number; width: number; height: number };
export type ViewportSize = { width: number; height: number };
export const windowPreference = 'test-driven-study.assistant-window';
const padding = 12;

export function viewportSize(): ViewportSize {
  return { width: window.visualViewport?.width ?? window.innerWidth,
    height: window.visualViewport?.height ?? window.innerHeight };
}

export function fitWindow(value: WindowGeometry, viewport: ViewportSize): WindowGeometry {
  const maxWidth = Math.max(1, viewport.width - 2 * padding);
  const maxHeight = Math.max(1, viewport.height - 2 * padding);
  const width = Math.min(maxWidth, Math.max(Math.min(300, maxWidth), value.width));
  const height = Math.min(maxHeight, Math.max(Math.min(300, maxHeight), value.height));
  return { width, height,
    x: Math.max(padding, Math.min(value.x, viewport.width - padding - width)),
    y: Math.max(padding, Math.min(value.y, viewport.height - padding - height)) };
}

export function defaultWindow(viewport: ViewportSize): WindowGeometry {
  const width = Math.min(400, viewport.width - 2 * padding);
  return fitWindow({ width, height: viewport.height,
    x: viewport.width - padding - width, y: padding }, viewport);
}

export function resizedWindow(value: WindowGeometry, delta: { x: number; y: number },
  viewport: ViewportSize): WindowGeometry {
  return fitWindow({ ...value,
    width: Math.min(value.width + delta.x, viewport.width - padding - value.x),
    height: Math.min(value.height + delta.y, viewport.height - padding - value.y),
  }, viewport);
}

export function readWindow(): WindowGeometry {
  const viewport = viewportSize();
  try {
    const value = JSON.parse(localStorage.getItem(windowPreference) ?? 'null') as WindowGeometry | null;
    if (value && ['x', 'y', 'width', 'height'].every(key =>
      Number.isFinite(value[key as keyof WindowGeometry]))) return fitWindow(value, viewport);
  } catch {
    // Storage may be unavailable or contain an obsolete value. Use page memory.
    return defaultWindow(viewport);
  }
  return defaultWindow(viewport);
}

export function rememberWindow(value: WindowGeometry) {
  try { localStorage.setItem(windowPreference, JSON.stringify(value)); }
  catch (error) { console.warn('Assistant window geometry could not be saved', error); }
}

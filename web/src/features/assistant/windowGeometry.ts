export type WindowGeometry = { x: number; y: number; width: number; height: number };
export type ViewportSize = { width: number; height: number };
export type WindowGeometryOptions = {
  storageKey?: string;
  width?: number;
  height?: number;
  rightOffset?: number;
};
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

export function defaultWindow(
  viewport: ViewportSize,
  options?: WindowGeometryOptions,
): WindowGeometry {
  const preferredWidth = options?.width ?? 400;
  const preferredHeight = options?.height ?? viewport.height;
  const rightOffset = options?.rightOffset ?? padding;
  const width = Math.min(preferredWidth, viewport.width - 2 * padding);
  const height = Math.min(preferredHeight, viewport.height - 2 * padding);
  const y = options?.height ? Math.max(padding, Math.round((viewport.height - height) / 2)) : padding;
  return fitWindow({ width, height,
    x: viewport.width - rightOffset - width, y }, viewport);
}

export function resizedWindow(value: WindowGeometry, delta: { x: number; y: number },
  viewport: ViewportSize): WindowGeometry {
  return fitWindow({ ...value,
    width: Math.min(value.width + delta.x, viewport.width - padding - value.x),
    height: Math.min(value.height + delta.y, viewport.height - padding - value.y),
  }, viewport);
}

export function readWindow(options?: WindowGeometryOptions): WindowGeometry {
  const viewport = viewportSize();
  const key = options?.storageKey ?? windowPreference;
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null') as WindowGeometry | null;
    if (value && ['x', 'y', 'width', 'height'].every(prop =>
      Number.isFinite(value[prop as keyof WindowGeometry]))) return fitWindow(value, viewport);
  } catch {
    // Storage may be unavailable or contain an obsolete value. Use page memory.
    return defaultWindow(viewport, options);
  }
  return defaultWindow(viewport, options);
}

export function rememberWindow(value: WindowGeometry, storageKey = windowPreference) {
  try { localStorage.setItem(storageKey, JSON.stringify(value)); }
  catch (error) { console.warn('Floating window geometry could not be saved', error); }
}

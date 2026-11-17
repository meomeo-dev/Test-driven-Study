import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { defaultWindow, fitWindow, readWindow, rememberWindow,
  viewportSize, type WindowGeometry } from './windowGeometry';
import { windowInteractions } from './windowInteractions';

export function useWindowGeometry() {
  const [geometry, setGeometry] = useState(readWindow);
  const current = useRef(geometry);
  const update = useCallback((value: WindowGeometry) => {
    const fitted = fitWindow(value, viewportSize());
    current.current = fitted;
    setGeometry(fitted);
  }, []);
  const save = useCallback(() => rememberWindow(current.current), []);
  const controls = useMemo(() => windowInteractions({ current, update, save }), [update, save]);
  useEffect(() => {
    const fit = () => update(current.current);
    window.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('resize', fit);
    return () => {
      window.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('resize', fit);
    };
  }, [update]);
  function reset() {
    update(defaultWindow(viewportSize()));
    save();
  }
  function fillHeight() {
    const { y, height } = defaultWindow(viewportSize());
    update({ ...current.current, y, height });
  }
  return { geometry, ...controls, reset, fillHeight };
}

export type WindowControls = ReturnType<typeof useWindowGeometry>;

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  defaultWindow, fitWindow, readWindow, rememberWindow,
  viewportSize, type WindowGeometry, type WindowGeometryOptions,
} from './windowGeometry';
import { windowInteractions } from './windowInteractions';

export function useWindowGeometry(options?: WindowGeometryOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const [geometry, setGeometry] = useState(() => readWindow(options));
  const current = useRef(geometry);
  const update = useCallback((value: WindowGeometry) => {
    const fitted = fitWindow(value, viewportSize());
    current.current = fitted;
    setGeometry(fitted);
  }, []);
  const save = useCallback(
    () => rememberWindow(current.current, optionsRef.current?.storageKey),
    [],
  );
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
    update(defaultWindow(viewportSize(), optionsRef.current));
    save();
  }
  function fillHeight() {
    const { y, height } = defaultWindow(viewportSize(), optionsRef.current);
    update({ ...current.current, y, height });
  }
  return { geometry, ...controls, reset, fillHeight };
}

export type WindowControls = ReturnType<typeof useWindowGeometry>;

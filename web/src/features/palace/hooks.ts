import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { coverage } from '../../api/palace';
import { preferenceEvent, preferenceKey, readPreferences, type Preferences } from './preferences';

export function usePalacePreferences(model: string) {
  const [value, setValue] = useState(() => {
    try { return readPreferences(localStorage.getItem(preferenceKey), model); }
    catch { return readPreferences(null, model); }
  });
  useEffect(() => {
    const changed = (event: Event) => setValue(readPreferences(
      JSON.stringify((event as CustomEvent<Preferences>).detail), model));
    const stored = (event: StorageEvent) => {
      if (event.key === preferenceKey) setValue(readPreferences(event.newValue, model));
    };
    window.addEventListener(preferenceEvent, changed); window.addEventListener('storage', stored);
    return () => { window.removeEventListener(preferenceEvent, changed); window.removeEventListener('storage', stored); };
  }, [model]);
  function change(next: Preferences) {
    setValue(next);
    try { localStorage.setItem(preferenceKey, JSON.stringify(next)); }
    catch (error) { console.warn('Generation preferences could not be saved', error); }
    window.dispatchEvent(new CustomEvent(preferenceEvent, {detail: next}));
  }
  return { value, change };
}

export function usePalaceCoverage(subject: number) {
  const query = useQuery({ queryKey: ['palace-coverage', subject],
    queryFn: ({ signal }) => coverage(subject, signal), staleTime: 5000, refetchInterval: 5000 });
  const entries = new Map((query.data ?? []).map(row => [row.question_id, row]));
  return { query, entries, marked: new Set(entries.keys()) };
}

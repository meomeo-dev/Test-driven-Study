import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as api from '../../api/practice';

export function useStudyQueries(filters: api.Filters) {
  const overview = useQuery({ queryKey: ['practice-overview', filters.subject],
    queryFn: ({ signal }) => api.overview(filters.subject, signal) });
  const reviewing = filters.state === 'review';
  // Answer mutations refresh the book, while the active review order stays put.
  const list = useQuery({
    queryKey: [reviewing ? 'practice-review-queue' : 'practice-questions', filters],
    queryFn: ({ signal }) => api.questions(filters, signal),
    ...(reviewing ? { refetchOnMount: 'always' as const, staleTime: 0 } : {}),
  });
  return { overview, list };
}

export function useSavedCursor(subject: number, id: number, onError: (message: string) => void) {
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void api.cursor(subject, id, controller.signal).catch(error => {
        if (!controller.signal.aborted) onError(error instanceof Error ? error.message : '浏览位置保存失败');
      });
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [subject, id, onError]);
}

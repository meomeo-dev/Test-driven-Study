import { useEffect, useRef } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/client';
import { exposure } from '../../api/practice';

export function useStudyQueries(filters: api.Filters) {
  return useQuery<StudySnapshot>({
    queryKey: ['memorization', filters],
    queryFn: async ({ signal }) => {
      const [overview, rows] = await Promise.all([
        api.overview(filters.subject, signal), api.questions(filters, signal),
      ]);
      return { overview, rows };
    },
    placeholderData: previous => previous?.overview.subject_id === filters.subject
      ? { overview: previous.overview, rows: [] }
      : undefined,
  });
}

export type StudySnapshot = { overview: api.Overview; rows: api.Summary[] };

export function useQuestionQuery(id: number) {
  return useQuery({ queryKey: ['question', id], enabled: id > 0,
    // Keep the reading surface mounted while the next original question loads.
    // The page disables learning mutations until its ID matches the requested ID.
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => api.detail(id, signal) });
}
export function useProgressMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, state }: { subject: number; id: number; state: api.ProgressState }) =>
      api.progress(id, state),
    onSuccess: async (_, input) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['memorization', { subject: input.subject }] }),
        client.invalidateQueries({ queryKey: ['overview', input.subject] }),
        client.invalidateQueries({ queryKey: ['question', input.id] }),
      ]);
    },
  });
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

export function useMemorizationExposure(id: number) {
  const visit = useRef({ question: 0, event: '' });
  useEffect(() => {
    if (!id) return;
    if (visit.current.question !== id) visit.current = { question: id, event: crypto.randomUUID() };
    const controller = new AbortController();
    void exposure(visit.current.event, id, controller.signal).catch(error => {
      if (!controller.signal.aborted) console.warn('Could not record answer exposure', error);
    });
    return () => controller.abort();
  }, [id]);
}

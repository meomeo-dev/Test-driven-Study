import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/learning';

// Practice and exams change concept states elsewhere, so both queries refresh
// whenever the learning page mounts.
export function useConceptGraph(course?: string) {
  return useQuery({
    queryKey: api.conceptsKey(course ?? ''), enabled: !!course, refetchOnMount: 'always',
    queryFn: ({ signal }) => api.readConcepts(course!, signal),
  });
}

export function useLearningPath(course?: string) {
  return useQuery({
    queryKey: api.learningPathKey(course ?? ''), enabled: !!course, refetchOnMount: 'always',
    queryFn: ({ signal }) => api.readLearningPath(course!, signal),
  });
}

export function useMarkKnown(course: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ concept, known }: { concept: string; known: boolean }) =>
      api.setConceptKnown(course, concept, known),
    onSuccess: graph => {
      client.setQueryData(api.conceptsKey(course), graph);
      void client.invalidateQueries({ queryKey: api.learningPathKey(course) });
    },
  });
}

export function useCreatePath(course: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (goal: api.LearningPathRequest) => api.createLearningPath(course, goal),
    onSuccess: path => client.setQueryData(api.learningPathKey(course), { path }),
  });
}

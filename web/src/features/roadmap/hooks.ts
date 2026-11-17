import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/roadmap';

// Practice, exams and concept marks change completion elsewhere, so both
// queries refresh whenever the roadmap tab mounts.
export function useRoadmap() {
  return useQuery({ queryKey: api.roadmapKey, refetchOnMount: 'always',
    queryFn: ({ signal }) => api.readRoadmap(signal) });
}

export function useRoadmapPath() {
  return useQuery({ queryKey: api.roadmapPathKey, refetchOnMount: 'always',
    queryFn: ({ signal }) => api.readRoadmapPath(signal) });
}

export function useMarkCompleted() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ course, completed }: { course: string; completed: boolean }) =>
      api.setCourseCompleted(course, completed),
    onSuccess: roadmap => {
      client.setQueryData(api.roadmapKey, roadmap);
      void client.invalidateQueries({ queryKey: api.roadmapPathKey });
    },
  });
}

export function useCreateRoadmapPath() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (goal: api.RoadmapPathRequest) => api.createRoadmapPath(goal),
    onSuccess: path => client.setQueryData(api.roadmapPathKey, { path }),
  });
}

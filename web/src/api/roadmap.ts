import { request } from './client';
import type {
  CourseRoadmap, RoadmapPath, RoadmapPathRequest, RoadmapPathView,
} from './generated/types.gen';
export type {
  CourseRoadmap, CourseState, RoadmapCourse, RoadmapGroup, RoadmapPath, RoadmapPathRequest,
  RoadmapPathView, RoadmapStep,
} from './generated/types.gen';

const send = (method: string, body: unknown): RequestInit => ({
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

export const roadmapKey = ['roadmap'] as const;
export const roadmapPathKey = ['roadmap-path'] as const;

export const readRoadmap = (signal?: AbortSignal) =>
  request<CourseRoadmap>('/api/roadmap', { signal });

export const setCourseCompleted = (course: string, completed: boolean) =>
  request<CourseRoadmap>(`/api/courses/${encodeURIComponent(course)}/completed`,
    send('PUT', { completed }));

export const readRoadmapPath = (signal?: AbortSignal) =>
  request<RoadmapPathView>('/api/roadmap/path', { signal });

export const createRoadmapPath = (goal: RoadmapPathRequest) =>
  request<RoadmapPath>('/api/roadmap/path', send('POST', goal));

import { request } from './client';
import type {
  ConceptGraph, LearningPath, LearningPathRequest, LearningPathView,
} from './generated/types.gen';
export type {
  ConceptGraph, ConceptState, ConceptStatus, LearningPath, LearningPathRequest,
  LearningPathStep, LearningPathView,
} from './generated/types.gen';

const course = (id: string) => `/api/courses/${encodeURIComponent(id)}`;
const send = (method: string, body: unknown): RequestInit => ({
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

export const conceptsKey = (id: string) => ['concepts', id] as const;
export const learningPathKey = (id: string) => ['learning-path', id] as const;

export const readConcepts = (id: string, signal?: AbortSignal) =>
  request<ConceptGraph>(`${course(id)}/concepts`, { signal });

export const setConceptKnown = (id: string, concept: string, known: boolean) =>
  request<ConceptGraph>(`${course(id)}/concepts/${encodeURIComponent(concept)}/known`,
    send('PUT', { known }));

export const readLearningPath = (id: string, signal?: AbortSignal) =>
  request<LearningPathView>(`${course(id)}/learning-path`, { signal });

export const createLearningPath = (id: string, goal: LearningPathRequest) =>
  request<LearningPath>(`${course(id)}/learning-path`, send('POST', goal));

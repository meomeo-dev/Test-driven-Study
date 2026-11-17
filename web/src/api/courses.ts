import { request } from './client';
import type { CourseSummary } from './generated/types.gen';

const base = '/api/courses';
export const courseListKey = ['courses'] as const;

export const listCourses = (signal?: AbortSignal) =>
  request<CourseSummary[]>(base, { signal });

export function courseAsset(course: string, version: string, filename: string) {
  const path = filename.split('/').map(encodeURIComponent).join('/');
  return `${base}/${encodeURIComponent(course)}/versions/${encodeURIComponent(version)}/${path}`;
}

export async function readCourseTranscript(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('逐字稿读取失败');
  return response.text();
}

export function questionAsset(question: {
  image_url: string; package_id?: string; package_version?: string;
}) {
  if (question.package_id && question.package_version) {
    return courseAsset(question.package_id, question.package_version, question.image_url);
  }
  return `/api/images/${encodeURIComponent(question.image_url)}`;
}

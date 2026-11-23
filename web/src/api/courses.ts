import { request } from './client';
import type {
  CourseActivateResponse,
  CourseDeactivateResponse,
  CourseInstallResponse,
  CoursePackagesResponse,
  CourseSummary,
} from './generated/types.gen';
export type {
  CourseActivateResponse,
  CourseDeactivateResponse,
  CourseInstallResponse,
  CoursePackageSummary,
  CoursePackageVersion,
  CoursePackagesResponse,
  CourseSummary,
} from './generated/types.gen';

const base = '/api/courses';
export const courseListKey = ['courses'] as const;
export const coursePackagesKey = ['course-packages'] as const;

export const listCourses = (signal?: AbortSignal) =>
  request<CourseSummary[]>(base, { signal });

export const listCoursePackages = (signal?: AbortSignal) =>
  request<CoursePackagesResponse>(`${base}/packages`, { signal, cache: 'no-store' });

export function installCoursePackage(file: File) {
  const form = new FormData();
  form.append('file', file);
  return request<CourseInstallResponse>(`${base}/install`, {
    method: 'POST',
    body: form,
  });
}

export function activateCourseVersion(course: string, version: string) {
  return request<CourseActivateResponse>(
    `${base}/${encodeURIComponent(course)}/versions/${encodeURIComponent(version)}/activate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    },
  );
}

export function deactivateCourse(course: string) {
  return request<CourseDeactivateResponse>(
    `${base}/${encodeURIComponent(course)}/deactivate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    },
  );
}

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

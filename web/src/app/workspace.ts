import { useQuery } from '@tanstack/react-query';
import { courseAsset, courseListKey, listCourses } from '../api/courses';

const firstPackageUnit = 101;

export function readSubject(params: URLSearchParams) {
  const value = Number(params.get('subject'));
  return Number.isSafeInteger(value) && value >= firstPackageUnit ? value : 0;
}

export function useCatalog() {
  return useQuery({ queryKey: courseListKey, queryFn: ({ signal }) => listCourses(signal) });
}

export function useWorkspace(subject: number) {
  const catalog = useCatalog();
  const course = catalog.data?.find(value => value.units.some(unit => unit.subject_id === subject));
  const units = course?.units ?? [];
  const unit = units.find(value => value.subject_id === subject);
  const logo = course?.logo
    ? courseAsset(course.id, course.version, course.logo)
    : undefined;
  return { course, units, unit, logo };
}

export function workspaceLink(mode: string, subject: number, course?: string, question?: number) {
  const query = new URLSearchParams({ subject: String(subject) });
  if (course) query.set('course', course);
  if (question) query.set('question', String(question));
  return `/${mode}?${query}`;
}

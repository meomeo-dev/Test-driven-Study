import type { QueryClient } from '@tanstack/react-query';
import {
  courseListKey,
  coursePackagesKey,
  type CoursePackageSummary,
  type CoursePackageVersion,
} from '../../api/courses';

export const MAX_COURSE_ZIP_BYTES = 64 * 1024 * 1024;

export const COURSE_LIFECYCLE_INVALIDATION_KEYS = [
  courseListKey,
  coursePackagesKey,
  ['roadmap'],
  ['roadmap-path'],
  ['concepts'],
  ['learning-path'],
] as const;

const installedTimeFormat = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export function validateCourseArchiveFile(file: {
  name: string;
  size: number;
}): string | null {
  if (!/\.zip$/i.test(file.name.trim())) {
    return '仅支持导入 .zip 格式的本地课程包文件。';
  }
  if (file.size <= 0) {
    return '所选课程包文件为空，请重新选择。';
  }
  if (file.size > MAX_COURSE_ZIP_BYTES) {
    return '课程包文件超过 64 MiB 限制，请精简后再导入。';
  }
  return null;
}

export function sortPackageVersions(
  versions: readonly CoursePackageVersion[],
): CoursePackageVersion[] {
  return [...versions].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    if (a.installed_at_ms !== b.installed_at_ms) {
      return b.installed_at_ms - a.installed_at_ms;
    }
    return b.version.localeCompare(a.version, undefined, { numeric: true });
  });
}

export function defaultReactivateVersion(
  pkg: CoursePackageSummary,
): string | null {
  if (pkg.active && pkg.active_version) return pkg.active_version;
  const sorted = sortPackageVersions(pkg.versions);
  return sorted[0]?.version ?? null;
}

export function shortDigest(digest: string): string {
  const clean = digest.replace(/^sha256:/i, '').trim();
  return clean.slice(0, 10);
}

export function formatInstalledAt(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  return installedTimeFormat.format(ms);
}

export async function invalidateCourseLifecycleQueries(
  client: QueryClient,
): Promise<void> {
  await Promise.all(
    COURSE_LIFECYCLE_INVALIDATION_KEYS.map(queryKey =>
      client.invalidateQueries({ queryKey }),
    ),
  );
}

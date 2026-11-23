import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as coursesApi from '../../api/courses';
import { CoursePackageManager } from './CoursePackageManager';
import { CoursePackageRow } from './CoursePackageRow';
import {
  defaultReactivateVersion,
  invalidateCourseLifecycleQueries,
  MAX_COURSE_ZIP_BYTES,
  shortDigest,
  sortPackageVersions,
  validateCourseArchiveFile,
} from './package-model';

const activePackageFixture: coursesApi.CoursePackageSummary = {
  course_id: 'beginner-english',
  title: '零基础英语',
  active_version: '2.4.0',
  active: true,
  versions: [
    {
      version: '2.3.0',
      protocol_version: 2,
      digest: 'sha256:abcdef0123456789',
      installed_at_ms: 1700000001000,
      active: false,
    },
    {
      version: '2.4.0',
      protocol_version: 2,
      digest: 'sha256:9988776655443322',
      installed_at_ms: 1700000002000,
      active: true,
    },
  ],
};

const inactivePackageFixture: coursesApi.CoursePackageSummary = {
  course_id: 'elementary-chinese',
  title: '小学语文',
  active_version: '',
  active: false,
  versions: [
    {
      version: '1.0.3',
      protocol_version: 1,
      digest: '1122334455667788',
      installed_at_ms: 1700000001000,
      active: false,
    },
    {
      version: '1.0.4',
      protocol_version: 1,
      digest: 'ffeeddccbbaa9988',
      installed_at_ms: 1700000005000,
      active: false,
    },
  ],
};

function stubFetchJson(payload: unknown) {
  const fetchMock = vi.fn<typeof fetch>(async () => new Response(
    JSON.stringify(payload),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  ));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('course package archive validation and sorting helpers', () => {
  it('validates local zip file extension, non-empty size, and 64 MiB cap', () => {
    expect(validateCourseArchiveFile({ name: 'demo.zip', size: 1024 })).toBeNull();
    expect(validateCourseArchiveFile({ name: 'DEMO.ZIP', size: MAX_COURSE_ZIP_BYTES })).toBeNull();
    expect(validateCourseArchiveFile({ name: 'demo.tar.gz', size: 1024 })).toContain('.zip');
    expect(validateCourseArchiveFile({ name: 'empty.zip', size: 0 })).toContain('为空');
    expect(validateCourseArchiveFile({ name: 'huge.zip', size: MAX_COURSE_ZIP_BYTES + 1 }))
      .toContain('64 MiB');
  });

  it('sorts active version first and selects most recent version when reactivating', () => {
    expect(sortPackageVersions(activePackageFixture.versions).map(v => v.version)).toEqual([
      '2.4.0',
      '2.3.0',
    ]);
    expect(defaultReactivateVersion(activePackageFixture)).toBe('2.4.0');
    expect(defaultReactivateVersion(inactivePackageFixture)).toBe('1.0.4');
    expect(shortDigest('sha256:abcdef0123456789')).toBe('abcdef0123');
    expect(shortDigest('1122334455667788')).toBe('1122334455');
  });
});

describe('course package API clients and query invalidation', () => {
  it('calls packages, multipart install, activate, and deactivate endpoints cleanly', async () => {
    const listMock = stubFetchJson({ packages: [activePackageFixture] });
    const listed = await coursesApi.listCoursePackages();
    expect(listed.packages).toHaveLength(1);
    expect(listMock).toHaveBeenCalledWith(
      '/api/courses/packages',
      expect.objectContaining({ cache: 'no-store' }),
    );

    const installMock = stubFetchJson({
      course_id: 'demo-course',
      version: '1.0.0',
      title: '演示课程',
      active: true,
      packages: [activePackageFixture],
    });
    const archive = new File(['zip-bytes'], 'demo-course.zip', { type: 'application/zip' });
    const installed = await coursesApi.installCoursePackage(archive);
    expect(installed.version).toBe('1.0.0');
    const installInit = installMock.mock.calls[0]?.[1];
    expect(installMock.mock.calls[0]?.[0]).toBe('/api/courses/install');
    expect(installInit?.method).toBe('POST');
    expect(installInit?.headers).toBeUndefined();
    expect(installInit?.body).toBeInstanceOf(FormData);
    expect((installInit?.body as FormData).get('file')).toBe(archive);

    const activateMock = stubFetchJson({
      course_id: 'beginner-english',
      version: '2.3.0',
      active: true,
    });
    const activated = await coursesApi.activateCourseVersion('beginner-english', '2.3.0');
    expect(activated.active).toBe(true);
    expect(activateMock).toHaveBeenCalledWith(
      '/api/courses/beginner-english/versions/2.3.0/activate',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }),
    );

    const deactivateMock = stubFetchJson({
      course_id: 'beginner-english',
      active: false,
    });
    const deactivated = await coursesApi.deactivateCourse('beginner-english');
    expect(deactivated.active).toBe(false);
    expect(deactivateMock).toHaveBeenCalledWith(
      '/api/courses/beginner-english/deactivate',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }),
    );
  });

  it('invalidates courses, packages, roadmap, and learning queries on lifecycle changes', async () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, 'invalidateQueries');
    await invalidateCourseLifecycleQueries(client);

    const keys = spy.mock.calls.map(call => call[0]?.queryKey);
    expect(keys).toEqual([
      ['courses'],
      ['course-packages'],
      ['roadmap'],
      ['roadmap-path'],
      ['concepts'],
      ['learning-path'],
    ]);
  });
});

describe('CoursePackageManager UI rendering', () => {
  it('renders zip import control, active/inactive lifecycle buttons, and no duplicate catalog links', () => {
    const client = new QueryClient();
    client.setQueryData(coursesApi.coursePackagesKey, {
      packages: [activePackageFixture, inactivePackageFixture],
    });

    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client },
        createElement(CoursePackageManager),
      ),
    );
    expect(html).toContain('导入本地课程包（.zip）');
    expect(html).toContain('作答、背题与错题记录');
    expect(html).toContain('已启用 · v2.4.0');
    expect(html).toContain('当前启用');
    expect(html).toContain('切换此版本');
    expect(html).toContain('停用');
    expect(html).toContain('已停用');
    expect(html).toContain('启用');
    expect(html).not.toContain('<a ');
  });

  it('renders inline confirmation with learner-history preservation note for deactivate and switch', () => {
    const deactivateHtml = renderToStaticMarkup(
      createElement(CoursePackageRow, {
        pkg: activePackageFixture,
        busy: false,
        pendingAction: {
          kind: 'deactivate',
          courseId: 'beginner-english',
          title: '零基础英语',
        },
        onRequestAction: () => {},
        onCancelAction: () => {},
        onConfirmAction: () => {},
      }),
    );
    expect(deactivateHtml).toContain('确认停用「零基础英语」');
    expect(deactivateHtml).toContain('作答、背题与错题记录会完整保留');
    expect(deactivateHtml).toContain('确认停用');
    expect(deactivateHtml).toContain('取消');

    const switchHtml = renderToStaticMarkup(
      createElement(CoursePackageRow, {
        pkg: activePackageFixture,
        busy: false,
        pendingAction: {
          kind: 'activate',
          courseId: 'beginner-english',
          version: '2.3.0',
          title: '零基础英语',
          reactivate: false,
        },
        onRequestAction: () => {},
        onCancelAction: () => {},
        onConfirmAction: () => {},
      }),
    );
    expect(switchHtml).toContain('确认将「零基础英语」切换至 v2.3.0');
    expect(switchHtml).toContain('学习记录与作答历史会继续保留');
    expect(switchHtml).toContain('确认切换');
  });
});

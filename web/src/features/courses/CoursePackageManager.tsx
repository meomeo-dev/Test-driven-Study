import { useRef, useState, type ChangeEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, PackagePlus, RotateCcw } from 'lucide-react';
import {
  activateCourseVersion,
  coursePackagesKey,
  deactivateCourse,
  installCoursePackage,
  listCoursePackages,
} from '../../api/courses';
import {
  CoursePackageRow,
  type PendingCourseAction,
} from './CoursePackageRow';
import {
  invalidateCourseLifecycleQueries,
  validateCourseArchiveFile,
} from './package-model';

export function CoursePackageManager() {
  const client = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [clientError, setClientError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingAction, setPendingAction] =
    useState<PendingCourseAction | null>(null);

  const packagesQuery = useQuery({
    queryKey: coursePackagesKey,
    queryFn: ({ signal }) => listCoursePackages(signal),
    staleTime: 0,
  });

  const installMutation = useMutation({
    mutationFn: (file: File) => installCoursePackage(file),
    retry: false,
    onSuccess: async data => {
      setClientError('');
      setPendingAction(null);
      setNotice(`已导入并启用「${data.title}」v${data.version}，原有学习记录保持不变。`);
      client.setQueryData(coursePackagesKey, { packages: data.packages });
      await invalidateCourseLifecycleQueries(client);
    },
  });

  const activateMutation = useMutation({
    mutationFn: (input: {
      courseId: string;
      version: string;
      title: string;
      reactivate: boolean;
    }) => activateCourseVersion(input.courseId, input.version),
    retry: false,
    onSuccess: async (data, variables) => {
      setClientError('');
      setPendingAction(null);
      setNotice(
        variables.reactivate
          ? `已启用「${variables.title}」v${data.version}，原有题目与学习记录已恢复。`
          : `已将「${variables.title}」切换至 v${data.version}，学习记录已保留。`,
      );
      await invalidateCourseLifecycleQueries(client);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (input: { courseId: string; title: string }) =>
      deactivateCourse(input.courseId),
    retry: false,
    onSuccess: async (_data, variables) => {
      setClientError('');
      setPendingAction(null);
      setNotice(`已停用「${variables.title}」，已安装版本与学习记录完整保留。`);
      await invalidateCourseLifecycleQueries(client);
    },
  });

  const busy =
    installMutation.isPending ||
    activateMutation.isPending ||
    deactivateMutation.isPending;

  const errorMessage =
    clientError ||
    installMutation.error?.message ||
    activateMutation.error?.message ||
    deactivateMutation.error?.message ||
    '';

  function resetFeedback() {
    setClientError('');
    setNotice('');
    installMutation.reset();
    activateMutation.reset();
    deactivateMutation.reset();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    resetFeedback();
    setPendingAction(null);
    const problem = validateCourseArchiveFile(file);
    if (problem) {
      setClientError(problem);
      return;
    }
    installMutation.mutate(file);
  }

  function confirmPendingAction() {
    if (!pendingAction) return;
    resetFeedback();
    if (pendingAction.kind === 'deactivate') {
      deactivateMutation.mutate({
        courseId: pendingAction.courseId,
        title: pendingAction.title,
      });
      return;
    }
    activateMutation.mutate({
      courseId: pendingAction.courseId,
      version: pendingAction.version,
      title: pendingAction.title,
      reactivate: pendingAction.reactivate,
    });
  }

  const packages = packagesQuery.data?.packages ?? [];

  return (
    <section className="course-packages" aria-label="课程包管理">
      <header className="course-packages-header">
        <div>
          <h2>课程包与版本管理</h2>
          <p className="muted course-packages-note">
            支持导入本地 .zip 课程包（最大 64 MiB）。切换版本、停用或重新启用均不会删除已安装版本、题目稳定 ID 或你的作答、背题与错题记录。
          </p>
        </div>
        <div className="course-import-control">
          <input
            ref={fileInput}
            type="file"
            accept=".zip,application/zip"
            className="sr-only"
            aria-label="选择本地课程包（.zip）"
            disabled={busy}
            onChange={handleFileChange}
          />
          <button
            type="button"
            className="button primary"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            {installMutation.isPending ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <PackagePlus size={15} />
            )}
            {installMutation.isPending ? '正在校验并导入…' : '导入本地课程包（.zip）'}
          </button>
        </div>
      </header>

      {notice && (
        <p role="status" className="course-package-notice">
          {notice}
        </p>
      )}
      {errorMessage && (
        <p role="alert" className="course-package-error">
          {errorMessage}
        </p>
      )}

      {packagesQuery.isPending ? (
        <p role="status" className="muted">
          正在读取已安装课程包…
        </p>
      ) : packagesQuery.error ? (
        <div role="alert" className="course-package-error-row">
          <span>{packagesQuery.error.message}</span>
          <button
            type="button"
            className="button outline"
            onClick={() => void packagesQuery.refetch()}
          >
            <RotateCcw size={14} />
            重试
          </button>
        </div>
      ) : packages.length === 0 ? (
        <p className="muted">尚无已安装的课程包，可点击上方按钮导入本地 .zip 课程包。</p>
      ) : (
        <div className="course-package-list">
          {packages.map(pkg => (
            <CoursePackageRow
              key={pkg.course_id}
              pkg={pkg}
              busy={busy}
              pendingAction={
                pendingAction?.courseId === pkg.course_id ? pendingAction : null
              }
              onRequestAction={action => {
                resetFeedback();
                setPendingAction(action);
              }}
              onCancelAction={() => setPendingAction(null)}
              onConfirmAction={confirmPendingAction}
            />
          ))}
        </div>
      )}
    </section>
  );
}

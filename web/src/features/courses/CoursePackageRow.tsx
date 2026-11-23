import { Power } from 'lucide-react';
import type { CoursePackageSummary } from '../../api/courses';
import {
  defaultReactivateVersion,
  formatInstalledAt,
  shortDigest,
  sortPackageVersions,
} from './package-model';

export type PendingCourseAction =
  | { kind: 'deactivate'; courseId: string; title: string }
  | {
      kind: 'activate';
      courseId: string;
      version: string;
      title: string;
      reactivate: boolean;
    };

export function CoursePackageRow({
  pkg,
  busy,
  pendingAction,
  onRequestAction,
  onCancelAction,
  onConfirmAction,
}: {
  pkg: CoursePackageSummary;
  busy: boolean;
  pendingAction: PendingCourseAction | null;
  onRequestAction: (action: PendingCourseAction) => void;
  onCancelAction: () => void;
  onConfirmAction: () => void;
}) {
  const title = pkg.title || pkg.course_id;
  const versions = sortPackageVersions(pkg.versions);
  const reactivateVersion = defaultReactivateVersion(pkg);

  return (
    <article className="course-package-card" data-active={pkg.active}>
      <div className="course-package-top">
        <div className="course-package-identity">
          <h3>{title}</h3>
          <code className="course-package-id">{pkg.course_id}</code>
          <span
            className={`course-package-badge ${pkg.active ? 'is-active' : 'is-inactive'}`}
          >
            {pkg.active ? `已启用 · v${pkg.active_version}` : '已停用'}
          </span>
        </div>
        <div className="course-package-actions">
          {pkg.active ? (
            <button
              type="button"
              className="button outline"
              disabled={busy}
              onClick={() =>
                onRequestAction({ kind: 'deactivate', courseId: pkg.course_id, title })
              }
            >
              <Power size={14} />
              停用
            </button>
          ) : (
            reactivateVersion && (
              <button
                type="button"
                className="button primary"
                disabled={busy}
                onClick={() =>
                  onRequestAction({
                    kind: 'activate',
                    courseId: pkg.course_id,
                    version: reactivateVersion,
                    title,
                    reactivate: true,
                  })
                }
              >
                启用
              </button>
            )
          )}
        </div>
      </div>

      {pendingAction && (
        <div className="course-package-confirm" role="region" aria-label="操作确认">
          <p>
            {pendingAction.kind === 'deactivate'
              ? `确认停用「${title}」？课程将从工作区隐藏，但所有版本、稳定题目 ID 及你的作答、背题与错题记录会完整保留，随时可重新启用。`
              : pendingAction.reactivate
                ? `确认启用「${title}」v${pendingAction.version}？原有题目与学习记录会自动恢复到工作区。`
                : `确认将「${title}」切换至 v${pendingAction.version}？稳定题目 ID 对应的学习记录与作答历史会继续保留。`}
          </p>
          <div className="course-package-confirm-actions">
            <button
              type="button"
              className="button primary"
              disabled={busy}
              onClick={onConfirmAction}
            >
              {busy
                ? '正在处理…'
                : pendingAction.kind === 'deactivate'
                  ? '确认停用'
                  : pendingAction.reactivate
                    ? '确认启用'
                    : '确认切换'}
            </button>
            <button
              type="button"
              className="button outline"
              disabled={busy}
              onClick={onCancelAction}
            >
              取消
            </button>
          </div>
        </div>
      )}

      <ul className="course-version-list" aria-label={`${title} 已安装版本`}>
        {versions.map(ver => {
          const installedAt = formatInstalledAt(ver.installed_at_ms);
          const digest = shortDigest(ver.digest);
          const isCurrent = pkg.active && ver.active;
          return (
            <li key={ver.version} className="course-version-row">
              <div className="course-version-meta">
                <strong>v{ver.version}</strong>
                <span>协议 v{ver.protocol_version}</span>
                {installedAt && <span>安装于 {installedAt}</span>}
                {digest && <code>{digest}</code>}
              </div>
              <div className="course-version-action">
                {isCurrent ? (
                  <span className="course-version-current">当前启用</span>
                ) : (
                  <button
                    type="button"
                    className="button outline"
                    disabled={busy}
                    onClick={() =>
                      onRequestAction({
                        kind: 'activate',
                        courseId: pkg.course_id,
                        version: ver.version,
                        title,
                        reactivate: !pkg.active,
                      })
                    }
                  >
                    {pkg.active ? '切换此版本' : '启用'}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

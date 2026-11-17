import { useEffect, type ReactNode } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';
import { BookOpen, ChevronLeft } from 'lucide-react';
import { courseAsset } from '../../api/courses';
import type { CourseSummary } from '../../api/generated/types.gen';
import { useCatalog, workspaceLink } from '../../app/workspace';
import { Tabs } from '../../components/Tabs';
import { ThemeToggle } from '../../components/ThemeToggle';
import { RoadmapTab } from '../roadmap/RoadmapTab';
import './courses.css';

const catalogTabs = [{ id: 'courses', label: '所有课程' }, { id: 'roadmap', label: '学习路线' }] as const;

function CourseShell({ children, title, catalog }: {
  children: ReactNode; title: string; catalog?: boolean;
}) {
  useEffect(() => { document.title = title; }, [title]);
  return <div className="course-shell">
    <header className="course-bar">
      {catalog ? <span><BookOpen size={18} />课程</span> :
        <Link to="/courses"><ChevronLeft size={18} />所有课程</Link>}
      <ThemeToggle />
    </header>
    <main className="course-main">{children}</main>
  </div>;
}

export function CourseCatalogPage() {
  const catalog = useCatalog();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'roadmap' ? 'roadmap' : 'courses';
  return <CourseShell title="课程" catalog>
    <h1>我的课程</h1>
    <div className="catalog-tabs">
      <Tabs prefix="catalog" label="课程视图" items={catalogTabs} value={tab}
        onChange={value => setParams(value === 'roadmap' ? { tab: value } : {})} />
    </div>
    <div id={`catalog-panel-${tab}`} role="tabpanel" aria-labelledby={`catalog-tab-${tab}`}>
      {catalog.isPending && <p role="status">正在读取课程…</p>}
      {catalog.error && <p role="alert">{catalog.error.message}</p>}
      {catalog.data?.length === 0 && <p>尚无已安装的课程。</p>}
      {catalog.data && (tab === 'roadmap' ? <RoadmapTab catalog={catalog.data} />
        : <CourseCards courses={catalog.data} />)}
    </div>
  </CourseShell>;
}

function CourseCards({ courses }: { courses: CourseSummary[] }) {
  return <div className="course-catalog">
    {courses.map(course => <Link className="course-card" key={course.id}
      to={`/courses/${course.id}`}>
      {course.logo && <img alt="" src={courseAsset(course.id, course.version, course.logo)} />}
      <div>
        <h2>{course.title}</h2>
        {course.description && <p>{course.description}</p>}
        <p className="muted">{course.units.length} 个单元</p>
      </div>
    </Link>)}
  </div>;
}

export function CoursePage() {
  const { courseId, unitId } = useParams();
  const catalog = useCatalog();
  const course = catalog.data?.find(value => value.id === courseId);
  const unit = unitId ? course?.units.find(value => value.id === unitId) :
    course?.units.find(value => value.has_practice) ?? course?.units[0];
  if (course && unit?.subject_id) {
    const path = unit.has_practice ? workspaceLink('memorize', unit.subject_id, course.id) :
      workspaceLink('guide', unit.subject_id, course.id);
    return <Navigate replace to={path} />;
  }
  return <CourseShell title="课程">
    {catalog.isPending ? <p role="status">正在读取课程…</p> :
      <p role="alert">{catalog.error?.message ?? '未找到此课程或单元。'}</p>}
  </CourseShell>;
}

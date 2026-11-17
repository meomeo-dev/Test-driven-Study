import { AlertCircle, LoaderCircle } from 'lucide-react';
import type { CourseSummary } from '../../api/generated/types.gen';
import { useRoadmap, useRoadmapPath } from './hooks';
import { RoadmapGraph } from './RoadmapGraph';
import { RoadmapRoute } from './RoadmapRoute';
import './roadmap.css';

// The catalog's 学习路线 tab: the saved route and the course graph.
export function RoadmapTab({ catalog }: { catalog: CourseSummary[] }) {
  const roadmap = useRoadmap();
  const path = useRoadmapPath();
  // Courses with concepts link to their learning path through a unit subject.
  const subjects = new Map(catalog.flatMap(course => {
    const unit = course.units.find(value => value.subject_id > 0);
    return unit ? [[course.id, unit.subject_id] as const] : [];
  }));
  const error = roadmap.error ?? path.error;
  if (error) {
    return <div className="page-state" role="alert"><AlertCircle size={26} /><p>{error.message}</p>
      <button className="button outline" onClick={() => { void roadmap.refetch(); void path.refetch(); }}>
        重新读取</button></div>;
  }
  if (!roadmap.data || !path.data) {
    return <div className="page-state" role="status"><LoaderCircle className="spin" size={26} />
      <p>正在读取学习路线…</p></div>;
  }
  return <div className="roadmap-content">
    <RoadmapRoute roadmap={roadmap.data} path={path.data.path ?? null} subjects={subjects} />
    <RoadmapGraph roadmap={roadmap.data} subjects={subjects} />
  </div>;
}

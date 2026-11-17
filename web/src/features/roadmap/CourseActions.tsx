import { BookOpen, Check, Route as RouteIcon, Undo2 } from 'lucide-react';
import { Link } from 'react-router';
import type { RoadmapCourse } from '../../api/roadmap';
import { workspaceLink } from '../../app/workspace';
import { useMarkCompleted } from './hooks';

// Actions for a course on the route and in the graph details. A course with
// concepts completes through its learning path; others take a manual mark.
export function CourseActions({ course, subject }: { course: RoadmapCourse; subject?: number }) {
  const mark = useMarkCompleted();
  return <div className="concept-actions">
    <Link className="button outline" to={`/courses/${encodeURIComponent(course.id)}`}>
      <BookOpen size={14} />打开课程</Link>
    {course.concept_count > 0 ? subject !== undefined && <Link className="button secondary"
      to={workspaceLink('learning', subject, course.id)}><RouteIcon size={14} />学习路径</Link>
      : <button type="button" className="button text" disabled={mark.isPending}
        onClick={() => mark.mutate({ course: course.id, completed: !course.marked_completed })}>
        {course.marked_completed ? <><Undo2 size={14} />取消已学完</>
          : <><Check size={14} />标记已学完</>}</button>}
    {mark.error && <span role="alert" className="concept-error">{mark.error.message}</span>}
  </div>;
}

import { useMemo, useState } from 'react';
import type { CourseRoadmap, RoadmapCourse } from '../../api/roadmap';
import { DependencyGraph } from '../learning/DependencyGraph';
import { CourseActions } from './CourseActions';
import {
  advisoryHint, completionText, courseStateLabels, courseTitles, edgeStrength, memberText, relatedCourseIds,
  relationText,
} from './model';

type Props = { roadmap: CourseRoadmap; subjects: Map<string, number> };

// Course graph: courses with installed prerequisite relations as a layered
// graph, the other courses as a list, and details of the selected course.
export function RoadmapGraph({ roadmap, subjects }: Props) {
  const related = useMemo(() => relatedCourseIds(roadmap.courses), [roadmap.courses]);
  const nodes = useMemo(() => roadmap.courses.filter(course => related.has(course.id))
    .map(course => ({ id: course.id, title: course.title, state: course.state,
      prerequisites: course.prerequisites.map(group => group.all_of),
      stateLabel: courseStateLabels[course.state] })), [roadmap.courses, related]);
  const others = roadmap.courses.filter(course => !related.has(course.id));
  const [selected, setSelected] = useState(nodes[0]?.id ?? roadmap.courses[0]?.id ?? '');
  const byId = new Map(roadmap.courses.map(course => [course.id, course]));
  const course = byId.get(selected);
  return <div className="graph-layout">
    <section className="learning-panel graph-panel" aria-label="课程关系图">
      <h2>课程关系图</h2>
      {nodes.length > 0 ? <DependencyGraph label="课程先修关系图" nodes={nodes} selected={selected}
        onSelect={setSelected} edgeClass={edge => edgeStrength(byId.get(edge.to), edge.from)} />
        : <p className="muted">已安装的课程之间尚未声明先修关系。</p>}
      <p className="graph-legend muted">实线：先修；点线：建议先修；虚线：可替代的先修组之一。
        先修关系依据课程说明，只用于排序和提示，不限制打开课程。</p>
      {others.length > 0 && <div className="roadmap-others">
        <h3>其他课程（无先修关系）</h3>
        <div className="roadmap-chips">
          {others.map(value => <button key={value.id} type="button" className="roadmap-chip"
            data-state={value.state} aria-pressed={value.id === selected}
            onClick={() => setSelected(value.id)}>
            {value.title}<span>{courseStateLabels[value.state]}</span></button>)}
        </div>
      </div>}
    </section>
    {course && <CourseDetails course={course} titles={courseTitles(roadmap.courses)}
      subject={subjects.get(course.id)} />}
  </div>;
}

function CourseDetails({ course, titles, subject }: {
  course: RoadmapCourse; titles: Map<string, string>; subject?: number;
}) {
  return <aside className="learning-panel concept-details" aria-label={`${course.title}详情`}>
    <h2>{course.title}</h2>
    <p><span className="state-badge" data-state={course.state}>{courseStateLabels[course.state]}</span>
      {!course.prerequisites_met && course.state !== 'completed'
        && <span className="muted"> {advisoryHint(course.state)}</span>}</p>
    {course.note && <p className="roadmap-note">课程说明：{course.note}</p>}
    <dl>
      <dt>先修课程</dt><dd>{relationText(course.prerequisites, titles)}</dd>
      {course.parallel_with.length > 0 && <>
        <dt>建议并行</dt><dd>{memberText(course.parallel_with, titles)}</dd></>}
      {course.missing.length > 0 && <><dt>未安装</dt><dd>{course.missing.join('、')}</dd></>}
      <dt>完成方式</dt><dd>{completionText(course)}</dd>
    </dl>
    <CourseActions course={course} subject={subject} />
  </aside>;
}

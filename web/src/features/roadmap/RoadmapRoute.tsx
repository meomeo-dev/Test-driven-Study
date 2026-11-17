import { useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, Lock, RefreshCw } from 'lucide-react';
import type { CourseRoadmap, RoadmapPath } from '../../api/roadmap';
import { CourseActions } from './CourseActions';
import { useCreateRoadmapPath } from './hooks';
import {
  advisoryHint, courseStateLabels, courseTitles, maxTargetCourses, relationText,
} from './model';

type Props = { roadmap: CourseRoadmap; path: RoadmapPath | null; subjects: Map<string, number> };

// The saved route across courses, or the goal form when there is none.
export function RoadmapRoute({ roadmap, path, subjects }: Props) {
  const [editing, setEditing] = useState(false);
  const create = useCreateRoadmapPath();
  if (!path || editing) {
    return <section className="learning-panel" aria-label="学习路线">
      <h2>{path ? '重新规划' : '生成学习路线'}</h2>
      {!path && <p className="muted">选择目标课程后，系统按课程说明中的先修关系排出学习顺序，并跳过已学完的课程。</p>}
      <GoalForm roadmap={roadmap} initial={path?.targets} pending={create.isPending}
        error={create.error?.message} onCancel={path ? () => setEditing(false) : undefined}
        onSubmit={targets => create.mutate({ targets }, { onSuccess: () => setEditing(false) })} />
    </section>;
  }
  return <section className="learning-panel" aria-label="学习路线">
    <RouteSummary path={path} onReplan={() => setEditing(true)} />
    <RouteSteps roadmap={roadmap} path={path} subjects={subjects} />
  </section>;
}

type GoalProps = {
  roadmap: CourseRoadmap;
  initial?: string[];
  pending: boolean;
  error?: string;
  onSubmit: (targets: string[]) => void;
  onCancel?: () => void;
};

function GoalForm({ roadmap, initial, pending, error, onSubmit, onCancel }: GoalProps) {
  const [scope, setScope] = useState(initial?.length ? 'courses' : 'all');
  const [targets, setTargets] = useState<string[]>(initial ?? []);
  const valid = scope === 'all' || (targets.length > 0 && targets.length <= maxTargetCourses);
  function toggle(id: string, checked: boolean) {
    setTargets(current => checked ? [...current, id] : current.filter(value => value !== id));
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (valid) onSubmit(scope === 'all' ? [] : targets);
  }
  return <form className="goal-form" aria-label="路线目标" onSubmit={submit}>
    <fieldset>
      <legend>学习目标</legend>
      <label><input type="radio" name="roadmap-scope" checked={scope === 'all'}
        onChange={() => setScope('all')} />全部课程</label>
      <label><input type="radio" name="roadmap-scope" checked={scope === 'courses'}
        onChange={() => setScope('courses')} />选择课程（最多 {maxTargetCourses} 门）</label>
    </fieldset>
    {scope === 'courses' && <fieldset className="goal-targets"><legend>目标课程</legend>
      {roadmap.courses.map(course => {
        const checked = targets.includes(course.id);
        return <label key={course.id}><input type="checkbox" checked={checked}
          disabled={!checked && targets.length >= maxTargetCourses}
          onChange={event => toggle(course.id, event.target.checked)} />{course.title}</label>;
      })}
    </fieldset>}
    {scope === 'courses' && targets.length === 0 && <p className="goal-hint">请至少选择一门课程。</p>}
    {error && <p className="goal-hint" role="alert">{error}</p>}
    <div className="goal-buttons">
      <button className="button primary" type="submit" disabled={pending || !valid}>
        {pending ? '正在规划…' : '生成学习路线'}</button>
      {onCancel && <button className="button text" type="button" onClick={onCancel}>取消</button>}
    </div>
    <p className="goal-hint">已学完的课程会被跳过；目标课程的先修和建议先修课程会排在它之前。</p>
  </form>;
}

function RouteSummary({ path, onReplan }: { path: RoadmapPath; onReplan: () => void }) {
  const counted = path.completed_steps + path.remaining_steps;
  return <header className="path-summary">
    <div className="path-progress">
      <strong>已学完 {path.completed_steps} · 剩余 {path.remaining_steps}</strong>
      <progress max={Math.max(counted, 1)} value={path.completed_steps} aria-label="学习路线进度" />
    </div>
    <button type="button" className="button outline" onClick={onReplan}><RefreshCw size={14} />重新规划</button>
    {path.completed && <p className="path-notice success" role="status">
      <CheckCircle2 size={15} />目标课程已全部学完，可以选择新的目标。</p>}
    {path.stale && <p className="path-notice" role="status"><AlertTriangle size={15} />
      已安装的课程或先修关系有变化，建议重新规划。</p>}
    {!path.stale && path.replan_suggested && <p className="path-notice" role="status">
      <AlertTriangle size={15} />学习进度变化后有更短的路线，建议重新规划。</p>}
    <p className="muted path-note">有知识点的课程按知识点进度判断是否学完，其他课程由你手动标记；先修关系不限制打开课程。</p>
  </header>;
}

function RouteSteps({ roadmap, path, subjects }: Props & { path: RoadmapPath }) {
  const titles = courseTitles(roadmap.courses);
  return <ol className="path-steps">
    {path.steps.map((step, index) => {
      const course = roadmap.courses.find(value => value.id === step.course_id);
      const next = step.course_id === path.next_course;
      return <li key={step.course_id} className="path-step" data-state={step.state}
        data-next={next || undefined} aria-current={next ? 'step' : undefined}>
        <span className="step-index">{index + 1}</span>
        <div className="step-body">
          <h3>{step.title}{next && <span className="step-next">下一步</span>}</h3>
          <p className="muted"><span className="state-badge" data-state={step.state}>
            {courseStateLabels[step.state]}</span></p>
          {step.strength && step.group.length > 0 && <p className="muted">
            {relationText([{ all_of: step.group, strength: step.strength }], titles)}</p>}
          {!step.done && !step.missing && !step.prerequisites_met && <p className="step-hint">
            <Lock size={13} />{advisoryHint(step.state)}</p>}
          {course && !step.missing && <CourseActions course={course} subject={subjects.get(course.id)} />}
        </div>
      </li>;
    })}
  </ol>;
}

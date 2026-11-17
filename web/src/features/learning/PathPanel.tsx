import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Lock, RefreshCw } from 'lucide-react';
import type { ConceptGraph, LearningPath } from '../../api/learning';
import { ConceptActions } from './ConceptActions';
import { GoalForm } from './GoalForm';
import { useCreatePath } from './hooks';
import { conceptTitles, markConflict, prerequisiteText, stateLabels } from './model';

type Props = { course: string; graph: ConceptGraph; path: LearningPath | null };

export function PathPanel({ course, graph, path }: Props) {
  const [editing, setEditing] = useState(false);
  const create = useCreatePath(course);
  if (!path || editing) {
    return <section className="learning-panel">
      <h2>{path ? '重新规划' : '生成学习路径'}</h2>
      {!path && <p className="muted">选择目标后，系统按先修关系排出学习顺序，并跳过已经掌握的知识点。</p>}
      <GoalForm graph={graph} pending={create.isPending} error={create.error?.message}
        initial={path ? { targets: path.targets, daily_minutes: path.daily_minutes } : undefined}
        onCancel={path ? () => setEditing(false) : undefined}
        onSubmit={goal => create.mutate(goal, { onSuccess: () => setEditing(false) })} />
    </section>;
  }
  return <section className="learning-panel" aria-label="学习路径">
    <PathSummary path={path} onReplan={() => setEditing(true)} />
    <PathSteps course={course} graph={graph} path={path} />
  </section>;
}

function PathSummary({ path, onReplan }: { path: LearningPath; onReplan: () => void }) {
  const counted = path.mastered_steps + path.known_steps + path.remaining_steps;
  const done = counted - path.remaining_steps;
  return <header className="path-summary">
    <div className="path-progress">
      <strong>已掌握 {path.mastered_steps} · 自评 {path.known_steps} · 剩余 {path.remaining_steps}</strong>
      <progress max={Math.max(counted, 1)} value={done} aria-label="学习路径进度" />
      <span className="muted">{path.completed ? '目标已全部完成。'
        : `剩余约 ${path.remaining_minutes} 分钟（估算），按每天 ${path.daily_minutes} 分钟约 ${path.estimated_days} 天。`}</span>
    </div>
    <button type="button" className="button outline" onClick={onReplan}><RefreshCw size={14} />重新规划</button>
    {path.completed && <p className="path-notice success" role="status">
      <CheckCircle2 size={15} />目标已完成，可以选择新的学习目标。</p>}
    {path.stale && <p className="path-notice" role="status"><AlertTriangle size={15} />
      课程知识图谱已更新，部分步骤可能已变化，建议重新规划。</p>}
    {!path.stale && path.replan_suggested && <p className="path-notice" role="status">
      <AlertTriangle size={15} />学习进度变化后有更合适的路线，建议重新规划。</p>}
    <p className="muted path-note">掌握度依据练习和模拟考试中每道题的最新作答。</p>
  </header>;
}

function PathSteps({ course, graph, path }: Props & { path: LearningPath }) {
  const titles = conceptTitles(graph);
  return <ol className="path-steps">
    {path.steps.map((step, index) => {
      const concept = graph.concepts.find(value => value.id === step.concept_id);
      const unit = graph.units.find(value => value.id === step.unit_id)?.title ?? step.unit_id;
      const next = step.concept_id === path.next_concept;
      return <li key={step.concept_id} className="path-step" data-state={step.state}
        data-next={next || undefined} aria-current={next ? 'step' : undefined}>
        <span className="step-index">{index + 1}</span>
        <div className="step-body">
          <h3>{step.title}{next && <span className="step-next">下一步</span>}</h3>
          <p className="muted">{unit} · {step.estimated_minutes} 分钟 ·
            <span className="state-badge" data-state={step.state}>{stateLabels[step.state]}</span></p>
          {step.group.length > 0 && <p className="muted">先修：{prerequisiteText([step.group], titles)}</p>}
          {!step.done && !step.missing && !step.unlocked && <p className="step-hint">
            <Lock size={13} />先修未完成，也可以先练习。</p>}
          {concept && markConflict(concept) && <p className="step-hint">
            <AlertTriangle size={13} />自评与练习不一致：最近有答错的题。</p>}
          {concept && !step.missing && <ConceptActions course={course} concept={concept} />}
        </div>
      </li>;
    })}
  </ol>;
}

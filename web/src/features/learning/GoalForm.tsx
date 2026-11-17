import { useState, type FormEvent } from 'react';
import type { ConceptGraph, LearningPathRequest } from '../../api/learning';
import { maxDailyMinutes, maxTargets, minDailyMinutes } from './model';

type Props = {
  graph: ConceptGraph;
  initial?: LearningPathRequest;
  pending: boolean;
  error?: string;
  onSubmit: (goal: LearningPathRequest) => void;
  onCancel?: () => void;
};

// Goal form: the whole course or chosen concepts, and daily study minutes.
export function GoalForm({ graph, initial, pending, error, onSubmit, onCancel }: Props) {
  const [scope, setScope] = useState(initial?.targets?.length ? 'concepts' : 'course');
  const [targets, setTargets] = useState<string[]>(initial?.targets ?? []);
  const [minutes, setMinutes] = useState(String(initial?.daily_minutes ?? 30));
  const daily = Number(minutes);
  const validMinutes = Number.isInteger(daily) && daily >= minDailyMinutes && daily <= maxDailyMinutes;
  const validTargets = scope === 'course' || (targets.length > 0 && targets.length <= maxTargets);
  function toggle(id: string, checked: boolean) {
    setTargets(current => checked ? [...current, id] : current.filter(value => value !== id));
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!validMinutes || !validTargets) return;
    onSubmit({ targets: scope === 'course' ? [] : targets, daily_minutes: daily });
  }
  return <form className="goal-form" aria-label="学习目标" onSubmit={submit}>
    <fieldset>
      <legend>学习目标</legend>
      <label><input type="radio" name="scope" checked={scope === 'course'}
        onChange={() => setScope('course')} />整门课程</label>
      <label><input type="radio" name="scope" checked={scope === 'concepts'}
        onChange={() => setScope('concepts')} />选择知识点（最多 {maxTargets} 个）</label>
    </fieldset>
    {scope === 'concepts' && <div className="goal-targets">
      {graph.units.map(unit => {
        const concepts = graph.concepts.filter(concept => concept.unit_id === unit.id);
        if (concepts.length === 0) return null;
        return <fieldset key={unit.id}><legend>{unit.title}</legend>
          {concepts.map(concept => {
            const checked = targets.includes(concept.id);
            return <label key={concept.id}><input type="checkbox" checked={checked}
              disabled={!checked && targets.length >= maxTargets}
              onChange={event => toggle(concept.id, event.target.checked)} />{concept.title}</label>;
          })}
        </fieldset>;
      })}
    </div>}
    <label className="goal-minutes">每天学习
      <input type="number" inputMode="numeric" min={minDailyMinutes} max={maxDailyMinutes} step={5}
        value={minutes} aria-invalid={!validMinutes} onChange={event => setMinutes(event.target.value)} />
      分钟<small>（{minDailyMinutes}–{maxDailyMinutes}）</small></label>
    {!validMinutes && <p className="goal-hint" role="alert">每天学习时间需在 10–480 分钟之间。</p>}
    {scope === 'concepts' && targets.length === 0 && <p className="goal-hint">请至少选择一个知识点。</p>}
    {error && <p className="goal-hint" role="alert">{error}</p>}
    <div className="goal-buttons">
      <button className="button primary" type="submit" disabled={pending || !validMinutes || !validTargets}>
        {pending ? '正在规划…' : '生成学习路径'}</button>
      {onCancel && <button className="button text" type="button" onClick={onCancel}>取消</button>}
    </div>
    <p className="goal-hint">已掌握或自评已会的知识点会被跳过；学习时间为估算。</p>
  </form>;
}

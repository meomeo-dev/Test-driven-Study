import { useMemo, useState } from 'react';
import type { ConceptGraph } from '../../api/learning';
import { ConceptActions } from './ConceptActions';
import { DependencyGraph } from './DependencyGraph';
import { conceptTitles, evidenceText, markConflict, prerequisiteText, stateLabels } from './model';

export function GraphPanel({ course, graph }: { course: string; graph: ConceptGraph }) {
  const [selected, setSelected] = useState(graph.concepts[0]?.id ?? '');
  const nodes = useMemo(() => graph.concepts.map(value => ({ id: value.id, title: value.title,
    prerequisites: value.prerequisites, state: value.state, stateLabel: stateLabels[value.state],
  })), [graph.concepts]);
  const titles = conceptTitles(graph);
  const concept = graph.concepts.find(value => value.id === selected);
  return <div className="graph-layout">
    <section className="learning-panel graph-panel" aria-label="知识图谱">
      <DependencyGraph label="知识点先修关系图" nodes={nodes} selected={selected}
        onSelect={setSelected} />
      <p className="graph-legend muted">实线：必需的先修；虚线：可替代的先修组之一，满足任一组即可解锁。</p>
    </section>
    {concept && <aside className="learning-panel concept-details" aria-label={`${concept.title}详情`}>
      <h2>{concept.title}</h2>
      <p><span className="state-badge" data-state={concept.state}>{stateLabels[concept.state]}</span>
        {!concept.unlocked && <span className="muted"> 先修未完成</span>}</p>
      {concept.summary && <p>{concept.summary}</p>}
      <dl>
        <dt>所属单元</dt><dd>{graph.units.find(unit => unit.id === concept.unit_id)?.title}</dd>
        <dt>先修条件</dt><dd>{prerequisiteText(concept.prerequisites, titles)}</dd>
        <dt>练习证据</dt><dd>{evidenceText(concept)}</dd>
        <dt>估算时间</dt><dd>{concept.estimated_minutes} 分钟</dd>
      </dl>
      {markConflict(concept) && <p className="step-hint">自评与练习不一致：最近有答错的题。</p>}
      <ConceptActions course={course} concept={concept} />
    </aside>}
  </div>;
}

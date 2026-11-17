import { useMemo } from 'react';
import { layoutGraph, nodeHeight, nodeWidth, type LayoutEdge } from './graphLayout';

export type GraphNode = {
  id: string;
  title: string;
  // Alternative prerequisite groups of node IDs; members outside the graph are ignored.
  prerequisites: string[][];
  state: string;
  stateLabel: string;
};

type Props = {
  label: string;
  nodes: GraphNode[];
  selected: string;
  onSelect: (id: string) => void;
  // Extra classes for an edge, e.g. a relation strength; alternatives are marked here.
  edgeClass?: (edge: LayoutEdge) => string;
};

// Layered SVG graph shared by the knowledge graph and the course roadmap.
// Nodes are focusable buttons that carry their state in the accessible name.
export function DependencyGraph({ label, nodes, selected, onSelect, edgeClass }: Props) {
  const layout = useMemo(() => layoutGraph(nodes), [nodes]);
  const byId = new Map(nodes.map(node => [node.id, node]));
  return <div className="graph-scroll">
    <svg width={layout.width} height={layout.height} role="group" aria-label={label}>
      {layout.edges.map(edge => <path key={`${edge.from}-${edge.to}`} d={edge.path}
        className={['graph-edge', edge.alternative ? 'alternative' : '', edgeClass?.(edge) ?? '']
          .filter(Boolean).join(' ')}
        data-active={edge.to === selected || edge.from === selected || undefined} />)}
      {layout.nodes.map(position => {
        const node = byId.get(position.id)!;
        return <g key={node.id} className="graph-node" data-state={node.state}
          data-selected={node.id === selected || undefined} role="button" tabIndex={0}
          aria-label={`${node.title}，${node.stateLabel}`} aria-pressed={node.id === selected}
          transform={`translate(${position.x} ${position.y})`} onClick={() => onSelect(node.id)}
          onKeyDown={event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            onSelect(node.id);
          }}>
          <rect width={nodeWidth} height={nodeHeight} rx={8} />
          <text x={12} y={24} className="node-title">{clip(node.title)}</text>
          <text x={12} y={44} className="node-state">{node.stateLabel}</text>
        </g>;
      })}
    </svg>
  </div>;
}

// SVG text does not wrap; long titles are shortened and kept whole in the label.
function clip(title: string) {
  return title.length > 11 ? `${title.slice(0, 10)}…` : title;
}

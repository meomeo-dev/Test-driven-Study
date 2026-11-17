import { describe, expect, it } from 'vitest';
import { layoutGraph, nodeHeight, nodeWidth } from './graphLayout';

const graph = [
  { id: 'counting', prerequisites: [] },
  { id: 'addition', prerequisites: [['counting']] },
  { id: 'subtraction', prerequisites: [['counting']] },
  { id: 'word-problems', prerequisites: [['addition'], ['subtraction']] },
  { id: 'estimation', prerequisites: [['addition', 'subtraction']] },
  { id: 'explain-aloud', prerequisites: [['word-problems']] },
];

describe('layoutGraph', () => {
  it('layers by the longest prerequisite chain and keeps author order', () => {
    const layout = layoutGraph(graph);
    const place = Object.fromEntries(layout.nodes.map(node => [node.id, [node.layer, node.row]]));
    expect(place).toEqual({
      counting: [0, 0], addition: [1, 0], subtraction: [1, 1],
      'word-problems': [2, 0], estimation: [2, 1], 'explain-aloud': [3, 0],
    });
    expect(layout.width).toBe(16 * 2 + 4 * nodeWidth + 3 * 64);
    expect(layout.height).toBe(16 * 2 + 2 * nodeHeight + 18);
  });

  it('marks edges of alternative groups and points every edge forward', () => {
    const layout = layoutGraph(graph);
    const edge = (from: string, to: string) =>
      layout.edges.find(value => value.from === from && value.to === to);
    expect(edge('addition', 'word-problems')?.alternative).toBe(true);
    expect(edge('addition', 'estimation')?.alternative).toBe(false);
    expect(layout.edges).toHaveLength(7);
    const layer = new Map(layout.nodes.map(node => [node.id, node.layer]));
    for (const value of layout.edges) expect(layer.get(value.from)!).toBeLessThan(layer.get(value.to)!);
  });

  it('ignores unknown members and terminates on a malformed cycle', () => {
    const layout = layoutGraph([
      { id: 'a', prerequisites: [['b'], ['missing']] },
      { id: 'b', prerequisites: [['a']] },
    ]);
    expect(layout.nodes).toHaveLength(2);
    expect(layout.edges.every(edge => edge.from !== 'missing')).toBe(true);
  });
});

// Layered layout for a concept graph. A concept's layer is the length of its
// longest prerequisite chain, so every edge points to a later layer. Within a
// layer, concepts keep author order. Pure function: tested without a DOM.

export const nodeWidth = 176;
export const nodeHeight = 60;
const columnGap = 64;
const rowGap = 18;
const padding = 16;

export type LayoutInput = { id: string; prerequisites: string[][] };
export type LayoutNode = { id: string; layer: number; row: number; x: number; y: number };
export type LayoutEdge = { from: string; to: string; alternative: boolean; path: string };
export type GraphLayout = { nodes: LayoutNode[]; edges: LayoutEdge[]; width: number; height: number };

function layers(concepts: LayoutInput[]) {
  const byId = new Map(concepts.map(concept => [concept.id, concept]));
  const result = new Map<string, number>();
  const visiting = new Set<string>();
  function layer(id: string): number {
    const known = result.get(id);
    if (known !== undefined) return known;
    // Validation rejects cycles; the guard only keeps a bad response finite.
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const members = byId.get(id)?.prerequisites.flat().filter(member => byId.has(member)) ?? [];
    const value = members.length === 0 ? 0 : 1 + Math.max(...members.map(layer));
    visiting.delete(id);
    result.set(id, value);
    return value;
  }
  concepts.forEach(concept => layer(concept.id));
  return result;
}

export function layoutGraph(concepts: LayoutInput[]): GraphLayout {
  const layerOf = layers(concepts);
  const rows = new Map<number, number>();
  const nodes = concepts.map(concept => {
    const layer = layerOf.get(concept.id) ?? 0;
    const row = rows.get(layer) ?? 0;
    rows.set(layer, row + 1);
    return { id: concept.id, layer, row,
      x: padding + layer * (nodeWidth + columnGap), y: padding + row * (nodeHeight + rowGap) };
  });
  const position = new Map(nodes.map(node => [node.id, node]));
  const edges: LayoutEdge[] = [];
  for (const concept of concepts) {
    const alternative = concept.prerequisites.length > 1;
    const members = new Set(concept.prerequisites.flat());
    for (const member of members) {
      const from = position.get(member);
      const to = position.get(concept.id);
      if (!from || !to) continue;
      edges.push({ from: member, to: concept.id, alternative, path: edgePath(from, to) });
    }
  }
  const columns = Math.max(0, ...nodes.map(node => node.layer + 1));
  const height = Math.max(0, ...rows.values());
  return { nodes, edges,
    width: padding * 2 + columns * nodeWidth + Math.max(0, columns - 1) * columnGap,
    height: padding * 2 + height * nodeHeight + Math.max(0, height - 1) * rowGap };
}

function edgePath(from: LayoutNode, to: LayoutNode) {
  const startX = from.x + nodeWidth;
  const startY = from.y + nodeHeight / 2;
  const endX = to.x;
  const endY = to.y + nodeHeight / 2;
  const middle = (startX + endX) / 2;
  return `M${startX} ${startY} C${middle} ${startY} ${middle} ${endY} ${endX} ${endY}`;
}

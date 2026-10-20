import type { DashboardFlowGraph, FlowNodeKind } from './types';

export function layoutFlow(graph: DashboardFlowGraph, stages: FlowNodeKind[]) {
  const columns = stages.map((stage) => graph.nodes.filter((node) => node.kind === stage));
  const maxNodes = Math.max(1, ...columns.map((column) => column.length));
  const width = Math.max(720, stages.length * 180); const height = Math.max(320, maxNodes * 36 + 80);
  const maxTotal = Math.max(1, ...columns.map((column) => column.reduce((sum, node) => sum + Math.max(0, node.value), 0)));
  const scale = (height - 80 - maxNodes * 2 - (maxNodes - 1) * 12) / maxTotal;
  const nodes = columns.flatMap((column, index) => {
    let y = 42;
    return column.map((node) => {
      const result = { ...node, x: 22 + index * (width - 130) / Math.max(1, stages.length - 1), y, height: 2 + Math.max(0, node.value) * scale };
      y += result.height + 12; return result;
    });
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, number>(); const incoming = new Map<string, number>();
  const links = graph.links.flatMap((link) => {
    const source = byId.get(link.source); const target = byId.get(link.target);
    if (!source || !target || link.value <= 0) return [];
    const thickness = link.value * scale;
    const sy = source.y + 1 + (outgoing.get(source.id) ?? 0) + thickness / 2;
    const ty = target.y + 1 + (incoming.get(target.id) ?? 0) + thickness / 2;
    outgoing.set(source.id, (outgoing.get(source.id) ?? 0) + thickness);
    incoming.set(target.id, (incoming.get(target.id) ?? 0) + thickness);
    const sx = source.x + 12; const tx = target.x; const mid = (sx + tx) / 2;
    return [{ ...link, thickness, path: `M${sx},${sy} C${mid},${sy} ${mid},${ty} ${tx},${ty}` }];
  });
  return { nodes, links, width, height };
}

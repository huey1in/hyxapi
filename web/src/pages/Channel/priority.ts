interface PriorityItem { id: number; priority: number | null }
interface PriorityChange { id: number; previous: number | null; priority: number | null }
export interface PriorityOrder { revision: string; items: PriorityItem[]; changes: PriorityChange[] }
export type Placement = 'before' | 'after' | 'same';

export function priorityMove(rows: PriorityItem[], sourceID: number, targetID: number, placement: Placement, order?: PriorityOrder) {
  const source = rows.find((row) => row.id === sourceID);
  const target = rows.find((row) => row.id === targetID);
  if (!source || !target || sourceID === targetID || !order?.revision) return null;
  if ([source, target].some((row) => {
    const item = order.items.find((candidate) => candidate.id === row.id);
    return !item || (row.priority ?? 0) !== (item.priority ?? 0);
  })) return null;
  return {
    revision: order.revision,
    id: sourceID,
    target_id: targetID,
    position: placement,
  };
}

export function priorityRestore(order: PriorityOrder) {
  return { revision: order.revision, restore: order.changes.map((change) => ({ id: change.id, previous: change.priority, priority: change.previous })) };
}

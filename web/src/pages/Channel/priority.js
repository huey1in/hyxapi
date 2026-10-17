export function priorityMove(rows, sourceID, targetID, placement = 'before') {
  const source = rows.find((row) => row.id === sourceID);
  const target = rows.find((row) => row.id === targetID);
  if (!source || !target || sourceID === targetID) return null;
  return {
    source_id: sourceID,
    target_id: targetID,
    source_before: Number(source.priority || 0),
    target_before: Number(target.priority || 0),
    placement,
  };
}

export type AutoGroupMode = 'inherit' | 'custom';

export function manualTokenGroups(token: { groups?: string[]; group?: string }): string[] {
  if (Array.isArray(token.groups)) return token.groups.filter((group) => group && group !== 'auto');
  if (!token.group || token.group === 'auto' || token.group === '[]') return [];
  try {
    const parsed: unknown = JSON.parse(token.group);
    if (Array.isArray(parsed)) return parsed.filter((group): group is string => typeof group === 'string' && group !== 'auto');
  } catch { /* Legacy single-group tokens store a plain name. */ }
  return token.group.split(',').map((group) => group.trim()).filter(Boolean);
}

export function reconcileAutoGroups(stored: string[] | null | undefined, available: string[], max: number) {
  const original = Array.isArray(stored) ? stored : [];
  const allowed = new Set(available);
  const groups = [...new Set(original)].filter((group) => allowed.has(group)).slice(0, max);
  return {
    mode: (original.length ? 'custom' : 'inherit') as AutoGroupMode,
    groups,
    changed: groups.length !== original.length,
  };
}

export function validateAutoGroups(mode: AutoGroupMode, groups: string[], max: number, available: string[], translate?: (key: string, options?: { count: number }) => string): string {
  if (mode === 'inherit') return '';
  if (!groups.length) return translate?.('Select at least one Auto group or inherit global settings') ?? '请选择至少一个 Auto 分组，或切换为继承全局配置';
  if (groups.length > max) return translate?.('Select at most {{count}} Auto groups', { count: max }) ?? `最多选择 ${max} 个 Auto 分组`;
  if (new Set(groups).size !== groups.length) return translate?.('Auto groups must be unique') ?? 'Auto 分组不能重复';
  if (groups.some((group) => !available.includes(group))) return translate?.('Selected Auto groups are no longer available. Select again.') ?? '所选 Auto 分组已失效，请重新选择';
  return '';
}

export function autoGroupsPayload(automatic: boolean, mode: AutoGroupMode, groups: string[]): string[] {
  return automatic && mode === 'custom' ? [...groups] : [];
}

const editableFields = [
  'id', 'type', 'key', 'openai_organization', 'test_model', 'name', 'weight',
  'base_url', 'other', 'models', 'group', 'model_mapping', 'status_code_mapping',
  'priority', 'auto_ban', 'tag', 'setting', 'param_override', 'header_override',
  'remark', 'settings', 'multi_key_mode', 'key_mode',
] as const;

function sameJSON(a: unknown, b: unknown): boolean {
  try {
    const parse = (value: unknown) => typeof value === 'string' ? JSON.parse(value || '{}') : value ?? {};
    return JSON.stringify(parse(a)) === JSON.stringify(parse(b));
  } catch {
    return a === b;
  }
}

// Submit explicit editable fields. Preserve unchanged serialized settings so a
// routing-only edit does not accidentally require sensitive configuration grants.
export function buildChannelPatch(form: Record<string, unknown>, original: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const field of editableFields) {
    if (!(field in form)) continue;
    if ((field === 'setting' || field === 'settings') && sameJSON(form[field], original[field])) {
      if (field in original) patch[field] = original[field];
      continue;
    }
    patch[field] = form[field];
  }
  return patch;
}

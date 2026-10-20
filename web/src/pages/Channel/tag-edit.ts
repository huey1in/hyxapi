import { validateModelMappingJson } from './model-mapping-validation.ts';

export const tagFields = ['new_tag', 'models', 'groups', 'priority', 'weight', 'model_mapping', 'param_override', 'header_override'] as const;
export type TagField = typeof tagFields[number];
export type TagValues = Record<TagField, string>;
export type TagEdit = { tag: string } & Partial<Record<TagField, string | number>>;
const bytes = (value: string) => new TextEncoder().encode(value).length;

export function buildTagEdit(tag: string, selected: Set<TagField>, values: TagValues, sensitive: boolean): TagEdit {
  if (!selected.size) throw new Error('Select at least one field to update');
  const result: TagEdit = { tag };
  for (const field of tagFields) {
    if (!selected.has(field)) continue;
    if (['param_override', 'header_override'].includes(field) && !sensitive) throw new Error('Sensitive write permission is required');
    let value = values[field].trim();
    if (field === 'new_tag' && ([...value].length > 255 || /[\r\n\0]/.test(value))) throw new Error('Invalid tag name');
    if (field === 'models') {
      const names = [...new Set(value.split(',').map((name) => name.trim()).filter(Boolean))];
      if (names.length > 1000 || names.some((name) => bytes(name) > 255 || /[\r\n\0]/.test(name))) throw new Error('Invalid model name');
      value = names.join(',');
    }
    if (field === 'groups' && (bytes(value) > 64 || /[\r\n\0]/.test(value))) throw new Error('Invalid channel groups');
    if (field === 'priority' || field === 'weight') {
      const number = value ? Number(value) : NaN;
      if (!Number.isSafeInteger(number)) throw new Error('Priority and weight must be safe integers');
      if (field === 'weight' && (number < 0 || number > 4294967295)) throw new Error('Weight must be between 0 and 4294967295');
      result[field] = number; continue;
    }
    if (field === 'model_mapping') {
      const validation = validateModelMappingJson(value);
      if (!validation.valid) throw new Error(validation.error);
      if (value && Object.entries(JSON.parse(value) as Record<string, string>).some(([key, target]) => !key.trim() || !target.trim())) throw new Error('Model mapping keys and values must not be empty');
    }
    if (['param_override', 'header_override'].includes(field) && value) {
      try { JSON.parse(value); } catch { throw new Error('Overrides must contain valid JSON'); }
    }
    result[field] = value;
  }
  return result;
}

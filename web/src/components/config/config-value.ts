export type ConfigValue = null | boolean | number | string | ConfigValue[] | { [key: string]: ConfigValue };
export type ValueType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
export type ConfigShape = {
  type?: ValueType;
  label?: string;
  multiline?: boolean;
  keyLabel?: string;
  keyModes?: { prefix: string; label: string }[];
  itemLabel?: string;
  fields?: Record<string, ConfigShape>;
  entry?: ConfigShape;
  initial?: ConfigValue;
  createValue?: () => ConfigValue;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
};
export type ConfigNode = {
  id: string;
  type: ValueType;
  value: string | boolean;
  children: { key: string; node: ConfigNode }[];
};
let sequence = 0;
function valueType(value: ConfigValue): ValueType {
  return value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value as ValueType;
}
export function configNode(value: ConfigValue): ConfigNode {
  const type = valueType(value);
  return {
    id: `config-${++sequence}`,
    type,
    value: typeof value === 'boolean' ? value : type === 'object' || type === 'array' || value === null ? '' : String(value),
    children: value !== null && typeof value === 'object'
      ? Object.entries(value).map(([key, item]) => ({ key, node: configNode(item) })) : [],
  };
}
export function initialValue(shape?: ConfigShape): ConfigValue {
  if (shape?.createValue) return shape.createValue();
  if (shape?.initial !== undefined) return shape.initial;
  switch (shape?.type) {
    case 'object': return {};
    case 'array': return [];
    case 'number': return 0;
    case 'boolean': return false;
    case 'null': return null;
    default: return '';
  }
}
export function readConfig(node: ConfigNode): ConfigValue {
  switch (node.type) {
    case 'null': return null;
    case 'boolean': return node.value === true;
    case 'string': return String(node.value);
    case 'number': {
      const raw = String(node.value);
      const number = Number(raw);
      if (!raw.trim() || !Number.isFinite(number)) throw new Error('Invalid number');
      return number;
    }
    case 'array': return node.children.map(({ node: child }) => readConfig(child));
    case 'object': {
      const keys = node.children.map(({ key }) => key);
      if (new Set(keys).size !== keys.length) throw new Error('Duplicate field');
      // Object.fromEntries preserves literal __proto__ keys without changing prototypes.
      return Object.fromEntries(node.children.map(({ key, node: child }) => [key, readConfig(child)]));
    }
  }
}
export function serializeConfig(node: ConfigNode, validate?: (raw: string) => boolean): string | null {
  try {
    const raw = JSON.stringify(readConfig(node));
    return !validate || validate(raw) ? raw : null;
  } catch { return null; }
}

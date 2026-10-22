import { useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button, IconButton, Input, Select, Switch, Textarea } from '../ui';
import { SettingsDraftContext } from './config-drafts';
import { configNode, initialValue, serializeConfig } from './config-value';
import type { ConfigNode, ConfigShape, ConfigValue, ValueType } from './config-value';

const types: { value: ValueType; label: string }[] = [
  { value: 'string', label: 'Text' }, { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' }, { value: 'object', label: 'Object' },
  { value: 'array', label: 'List' }, { value: 'null', label: 'Null' },
];
function ValueEditor({ node, shape, path, onChange }: {
  node: ConfigNode; shape?: ConfigShape; path: string; onChange: (node: ConfigNode) => void;
}) {
  const { t } = useTranslation();
  const [field, setField] = useState('');
  const structured = node.type === 'object' || node.type === 'array';
  const freeType = !shape?.type || shape.type !== node.type;
  const remaining = Object.entries(shape?.fields ?? {}).filter(([key]) => !node.children.some((child) => child.key === key));
  const add = (key = node.type === 'array' ? '' : field) => {
    const childShape = node.type === 'object' && Object.hasOwn(shape?.fields ?? {}, key) ? shape?.fields?.[key] : shape?.entry;
    onChange({ ...node, children: [...node.children, { key, node: configNode(initialValue(childShape)) }] });
    setField('');
  };
  const newField = <div className='flex min-w-0 flex-wrap items-center gap-2'>
    <div className='min-w-0 max-w-64 flex-1 basis-32'><Input width='full' aria-label={`${path} ${t('New field name')}`} placeholder={t(shape?.keyLabel ?? 'New field name')} value={field} onChange={setField} /></div>
    <Button size='sm' variant='toggle' icon={Plus} disabled={!field.trim() || node.children.some((child) => child.key === field)} onClick={() => add()}>{t('Add field')}</Button>
  </div>;
  return <div className='min-w-0 space-y-2'>
    {freeType && <Select aria-label={`${path} ${t('Value type')}`} value={node.type}
      options={types.map((type) => ({ ...type, label: t(type.label) }))}
      onChange={(type) => onChange({ ...configNode(initialValue({ type })), id: node.id })} />}
    {node.type === 'string' && (shape?.options ? <Select aria-label={path} value={String(node.value)}
      options={shape.options.some((option) => option.value === node.value) ? shape.options.map((option) => ({ ...option, label: t(option.label) })) : [...shape.options.map((option) => ({ ...option, label: t(option.label) })), { value: String(node.value), label: String(node.value) }]}
      onChange={(value) => onChange({ ...node, value })} />
      : shape?.multiline ? <Textarea aria-label={path} rows={5} width='full' value={String(node.value)} onChange={(value) => onChange({ ...node, value })} />
        : <Input aria-label={path} width='full' value={String(node.value)} onChange={(value) => onChange({ ...node, value })} />)}
    {node.type === 'number' && (shape?.options ? <Select aria-label={path} value={String(node.value)}
      options={shape.options.some((option) => option.value === node.value) ? shape.options.map((option) => ({ ...option, label: t(option.label) })) : [...shape.options.map((option) => ({ ...option, label: t(option.label) })), { value: String(node.value), label: String(node.value) }]}
      onChange={(value) => onChange({ ...node, value })} />
      : <Input aria-label={path} type='number' step='any' min={shape?.min} max={shape?.max}
        width='full' value={String(node.value)} invalid={!String(node.value).trim() || !Number.isFinite(Number(node.value))}
        onChange={(value) => onChange({ ...node, value })} />)}
    {node.type === 'boolean' && <Switch aria-label={path} checked={node.value === true} onChange={(value) => onChange({ ...node, value })} />}
    {node.type === 'null' && <span className='text-xs text-ui-text-3'>{t('Null')}</span>}
    {structured && <>
      <div className='min-w-0 divide-y divide-ui-border'>
        {node.children.map((child, index) => {
          const known = node.type === 'object' && Object.hasOwn(shape?.fields ?? {}, child.key);
          const childShape = known ? shape?.fields?.[child.key] : shape?.entry;
          const mode = shape?.keyModes?.find((mode) => mode.prefix && child.key.startsWith(mode.prefix))?.prefix ?? '';
          const setKey = (key: string) => onChange({ ...node, children: node.children.map((item, i) => i === index ? { ...item, key } : item) });
          const label = node.type === 'array' ? `${t(shape?.itemLabel ?? 'Item')} ${index + 1}` : known ? t(childShape?.label ?? child.key) : child.key;
          const nested = child.node.type === 'object' || child.node.type === 'array';
          const edit = (next: ConfigNode) => onChange({ ...node, children: node.children.map((item, i) => i === index ? { ...item, node: next } : item) });
          return <div key={child.node.id} className={`min-w-0 py-3 first:pt-0 ${nested ? 'space-y-3' : 'grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,320px)] sm:items-center sm:gap-4'}`} data-config-row>
            <div className='flex min-w-0 flex-wrap items-center justify-between gap-2'>
              {node.type === 'object' && !known ? <div className='flex min-w-0 flex-1 basis-32 items-center gap-2 sm:max-w-sm'>
                {shape?.keyModes && <Select aria-label={`${path} ${t('Group action')} ${index + 1}`} value={mode}
                  options={shape.keyModes.map((item) => ({ value: item.prefix, label: t(item.label) }))}
                  onChange={(prefix) => setKey(prefix + child.key.slice(mode.length))} />}
                <div className='min-w-0 flex-1'>
                <Input aria-label={`${path} ${t(shape?.keyLabel ?? 'Field name')} ${index + 1}`} width='full'
                  placeholder={t(shape?.keyLabel ?? 'Field name')} value={child.key.slice(mode.length)}
                  invalid={node.children.some((item, i) => i !== index && item.key === child.key)}
                  onChange={(key) => setKey(mode + key)} />
                </div>
              </div> : <span className='min-w-0 break-words text-sm text-ui-text-2'>{label}</span>}
              <div className='ml-auto flex shrink-0 items-center gap-1'>
                {node.type === 'array' && <>
                  <IconButton icon={ArrowUp} title={`${t('Move up')} ${index + 1}`} disabled={index === 0} onClick={() => {
                    const children = [...node.children]; [children[index - 1], children[index]] = [children[index], children[index - 1]]; onChange({ ...node, children });
                  }} />
                  <IconButton icon={ArrowDown} title={`${t('Move down')} ${index + 1}`} disabled={index === node.children.length - 1} onClick={() => {
                    const children = [...node.children]; [children[index + 1], children[index]] = [children[index], children[index + 1]]; onChange({ ...node, children });
                  }} />
                </>}
                <IconButton icon={Trash2} title={`${t('Delete')} ${label || index + 1}`} onClick={() => onChange({ ...node, children: node.children.filter((_, i) => i !== index) })} />
              </div>
            </div>
            <div className={nested ? 'min-w-0 border-l border-ui-border pl-3 sm:pl-4' : 'min-w-0 sm:ml-auto sm:max-w-sm'}>
              <ValueEditor node={child.node} shape={childShape} path={`${path} / ${label || index + 1}`} onChange={edit} />
            </div>
          </div>;
        })}
      </div>
      {node.type === 'array' ? <Button size='sm' variant='toggle' icon={Plus} onClick={() => add()}>{t('Add item')}</Button>
        : shape?.fields ? <div className='min-w-0 space-y-3'>
          {remaining.length > 0 && <Select aria-label={`${path} ${t('Available fields')}`} value=''
            placeholder={t('Available fields')} options={remaining.map(([key, definition]) => ({ value: key, label: t(definition.label ?? key) }))} onChange={(key) => add(key)} />}
          <details className='min-w-0 text-xs text-ui-text-3'><summary className='cursor-pointer'>{t('Add custom field')}</summary><div className='mt-2'>{newField}</div></details>
        </div> : newField}
    </>}
  </div>;
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  shape?: ConfigShape;
  label: string;
  configKey?: string;
  validate?: (value: string) => boolean;
  onInvalidChange?: (invalid: boolean) => void;
};
export default function VisualConfigEditor({ value, onChange, shape, label, configKey, validate, onInvalidChange }: Props) {
  const { t } = useTranslation();
  const context = useContext(SettingsDraftContext);
  const cacheKey = configKey ? `visual:${configKey}` : '';
  const parse = () => {
    try { return configNode(JSON.parse(value || JSON.stringify(initialValue(shape))) as ConfigValue); }
    catch { return null; }
  };
  const [node, setNode] = useState<ConfigNode | null>(() => cacheKey && context?.cache.has(cacheKey) ? context.cache.get(cacheKey)!.value as ConfigNode : parse());
  const emitted = useRef(value);
  const previous = useRef(value);
  const validity = useRef(onInvalidChange); validity.current = onInvalidChange;
  useEffect(() => {
    if (previous.current !== value && emitted.current !== value) setNode(parse());
    previous.current = value;
  }, [value]);
  const invalid = node === null || serializeConfig(node, validate) === null;
  useEffect(() => { validity.current?.(invalid); }, [invalid]);
  useEffect(() => () => validity.current?.(false), []);
  const update = (next: ConfigNode) => {
    setNode(next);
    const raw = serializeConfig(next, validate);
    if (cacheKey && context) {
      context.cache.set(cacheKey, { value: next, invalid: raw === null });
      context.changed();
    }
    if (raw !== null) { emitted.current = raw; onChange(raw); }
  };
  return <div role='group' aria-label={t(label)} data-visual-config={configKey ?? label} data-setting-invalid={invalid ? 'true' : undefined} className='min-w-0 space-y-3'>
    {node ? <ValueEditor node={node} shape={shape} path={t(label)} onChange={update} /> : <>
      <p role='alert' className='text-xs text-ui-danger'>{t('This configuration cannot be read. The saved value is preserved until you choose to replace it.')}</p>
      <Button size='sm' variant='toggle' onClick={() => update(configNode(initialValue(shape)))}>{t('Replace with an empty configuration')}</Button>
    </>}
    {node && invalid && <p role='alert' className='text-xs text-ui-danger'>{t('Complete all required fields and correct duplicate names or invalid values before saving.')}</p>}
  </div>;
}

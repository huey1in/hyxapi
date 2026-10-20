import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui';
import type { BillingUsageSchema } from '../../../features/pricing/types';
import {
  createDefaultTaskVisualConfig, generateTaskExprFromConfig, getTaskEnumFields, getTaskNumberFields,
  taskMatrixRowLabel, tryParseTaskMatrixConfig, tryParseEditableTaskConfig,
} from '../../../features/pricing/lib/task-expr';
import type { TaskVisualConfig, TaskVisualTier } from '../../../features/pricing/lib/task-expr';
import { Input, Select, Textarea } from './controls';
import { usageLabel, usageUnit } from './usage-labels';

type DraftTier = Omit<TaskVisualTier, 'constant' | 'unitPrices'> & { constant: string; unitPrices: Record<string, string> };
const draftTiers = (config: TaskVisualConfig | null): DraftTier[] | null => config?.tiers.map((tier) => ({
  ...tier, constant: String(tier.constant), unitPrices: Object.fromEntries(Object.entries(tier.unitPrices).map(([key, value]) => [key, String(value)])),
})) ?? null;

type Props = { value: string; schema: BillingUsageSchema; onChange: (value: string) => void; onInvalidChange: (invalid: boolean) => void };
export default function TaskBillingEditor({ value, schema, onChange, onInvalidChange }: Props) {
  const { t, i18n } = useTranslation();
  const [tiers, setTiers] = useState(() => draftTiers(tryParseEditableTaskConfig(value, schema)));
  const [view, setView] = useState('visual');
  const [error, setError] = useState('');
  const source = useRef(value);
  const invalidCallback = useRef(onInvalidChange);
  invalidCallback.current = onInvalidChange;
  const numbers = getTaskNumberFields(schema);
  const enums = getTaskEnumFields(schema);
  const combinations = enums.reduce((count, [, definition]) => count * (definition.enum?.length || 1), 1);
  useEffect(() => {
    if (source.current === value) return;
    source.current = value; setTiers(draftTiers(tryParseEditableTaskConfig(value, schema))); setError('');
    invalidCallback.current(false);
  }, [value, schema]);
  useEffect(() => () => invalidCallback.current(false), []);

  const update = (next: DraftTier[]) => {
    setTiers(next);
    const invalid = next.some((tier, index) => !tier.label.trim()
      || [tier.constant, ...Object.values(tier.unitPrices)].some((price) => !price.trim() || !Number.isFinite(Number(price)) || Number(price) < 0)
      || (index < next.length - 1 && tier.conditions.length === 0)
      || new Set(tier.conditions.map(({ field }) => field)).size !== tier.conditions.length
      || tier.conditions.some(({ field, value: choice }) => !schema[field]?.enum?.includes(choice)));
    if (invalid) { setError('Enter finite non-negative prices, tier names and valid conditions. The final tier is the fallback.'); onInvalidChange(true); return; }
    const expression = generateTaskExprFromConfig({ tiers: next.map((tier) => ({ ...tier, constant: Number(tier.constant),
      unitPrices: Object.fromEntries(Object.entries(tier.unitPrices).map(([field, price]) => [field, Number(price)])),
    })) }, schema);
    if (!expression) { setError('Cannot generate task prices. Use the raw expression.'); onInvalidChange(true); return; }
    setError(''); onInvalidChange(false); source.current = expression; onChange(expression);
  };
  const changeTier = (index: number, next: DraftTier) => update((tiers ?? []).map((tier, i) => i === index ? next : tier));
  const reset = () => { setTiers(draftTiers(tryParseEditableTaskConfig(value, schema))); setError(''); onInvalidChange(false); };
  const visual = view === 'visual' && tiers !== null;
  return <div aria-label={t('Task usage billing editor')} className='min-w-0 space-y-3'>
    <Select width='100%' value={visual ? 'visual' : 'raw'} options={[
      { value: 'visual', label: t('Price by task usage'), disabled: !tiers }, { value: 'raw', label: t('Raw expression') },
    ]} onChange={setView} />
    <p className='text-xs text-ui-text-3'>{t('Tasks use plugin-reported usage: USD per unit, or USD per 1M tokens. Task expressions do not use fixed().')}</p>
    {!tiers && value.trim() && <p className='text-xs text-ui-text-3'>{t('This expression cannot become a task price table. The original is preserved; edit boolean or complex conditions in the raw expression.')}</p>}
    {!value.trim() && numbers.length > 0 && <Button variant='secondary' size='sm' onClick={() => {
      update(draftTiers(createDefaultTaskVisualConfig(schema))!); setView('visual');
    }}>{t('Create task price draft')}</Button>}
    {visual ? <>
      {enums.length > 0 && combinations <= 64 && <Button variant='secondary' size='sm' disabled={Boolean(error)} onClick={() => {
        const matrix = tryParseTaskMatrixConfig(value, schema);
        if (matrix) update(draftTiers({ tiers: matrix.rows.map((row, index) => ({
          ...row, label: taskMatrixRowLabel(row.combination), conditions: index === matrix.rows.length - 1 ? []
            : Object.entries(row.combination).map(([field, value]) => ({ field, value })),
        })) })!);
      }}>{t('Expand parameter combinations ({{count}})', { count: combinations })}</Button>}
      {tiers.map((tier, index) => <section key={index} className='min-w-0 space-y-3 rounded-xl border border-ui-border p-3'>
        <div className='flex flex-wrap items-center justify-between gap-2 text-xs text-ui-text-3'>
          <span>{index === tiers.length - 1 ? t('Fallback tier') : t('Conditional tier {{index}}', { index: index + 1 })}</span>
          {tiers.length > 1 && <Button variant='link' size='sm' onClick={() => update(tiers.filter((_, i) => i !== index).map((item, i, all) => i === all.length - 1 ? { ...item, conditions: [] } : item))}>{t('Remove tier')}</Button>}
        </div>
        <label className='grid min-w-0 gap-1 text-xs text-ui-text-3'>{t('Tier name')}
          <Input aria-label={t('Task tier name')} value={tier.label} onChange={(label) => changeTier(index, { ...tier, label })} />
        </label>
        {index < tiers.length - 1 && <>
          <p className='text-xs text-ui-text-3'>{t('Use this tier when all conditions match. Tiers are checked from top to bottom.')}</p>
          {tier.conditions.map((condition, conditionIndex) => <div key={conditionIndex} className='grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]'>
            <Select width='100%' value={condition.field} options={enums.map(([field, definition]) => ({ value: field, label: usageLabel(definition.description, field, i18n.language) }))}
              onChange={(field) => changeTier(index, { ...tier, conditions: tier.conditions.map((item, i) => i === conditionIndex ? { field, value: schema[field].enum![0] } : item) })} />
            <Select width='100%' value={condition.value} options={(schema[condition.field]?.enum || []).map((choice) => ({ value: choice, label: usageLabel(schema[condition.field]?.enumLabels?.[choice], choice, i18n.language) }))}
              onChange={(choice) => changeTier(index, { ...tier, conditions: tier.conditions.map((item, i) => i === conditionIndex ? { ...item, value: choice } : item) })} />
            <Button size='sm' variant='link' onClick={() => changeTier(index, { ...tier, conditions: tier.conditions.filter((_, i) => i !== conditionIndex) })}>{t('Remove condition')}</Button>
          </div>)}
          <Select width='100%' value='' placeholder={t('Add usage condition')} options={enums.filter(([field]) => !tier.conditions.some((item) => item.field === field)).map(([field, definition]) => ({ value: field, label: usageLabel(definition.description, field, i18n.language) }))}
            onChange={(field) => changeTier(index, { ...tier, conditions: [...tier.conditions, { field, value: schema[field].enum![0] }] })} />
        </>}
        <div className='grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2'>
          <label className='grid min-w-0 gap-1 text-xs text-ui-text-3'>{t('Base cost per task')} · USD
            <Input aria-label={t('Task base cost')} inputMode='decimal' value={tier.constant} onChange={(constant) => changeTier(index, { ...tier, constant })} />
          </label>
          {numbers.map(([field, definition]) => <label key={field} className='grid min-w-0 gap-1 text-xs text-ui-text-3'>
            {usageLabel(definition.description, field, i18n.language)} · USD / {usageUnit(definition, i18n.language, t)}
            <Input aria-label={t('Task unit price {{field}}', { field })} inputMode='decimal' value={tier.unitPrices[field] ?? '0'} onChange={(price) => changeTier(index, { ...tier, unitPrices: { ...tier.unitPrices, [field]: price } })} />
          </label>)}
        </div>
        {enums.length > 0 && <div className='flex flex-wrap gap-2'>
          <Button variant='secondary' size='sm' onClick={() => {
            const [field, definition] = enums[0];
            const next = [...tiers]; next.splice(index, 0, { ...tier, label: `${tier.label}-condition`, conditions: [{ field, value: definition.enum![0] }], unitPrices: { ...tier.unitPrices } }); update(next);
          }}>{t('Insert conditional tier before this')}</Button>
          {index > 0 && index < tiers.length - 1 && <Button variant='link' size='sm' onClick={() => {
            const next = [...tiers]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; update(next);
          }}>{t('Move tier up')}</Button>}
        </div>}
      </section>)}
    </> : <Textarea aria-label={t('Task billing expression')} value={value} rows={7} onChange={onChange} />}
    {error && <div role='alert' className='space-y-2 text-xs text-ui-danger'><p>{t(error)}</p>
      <Button size='sm' variant='secondary' onClick={reset}>{t('Discard invalid task changes')}</Button>
    </div>}
  </div>;
}

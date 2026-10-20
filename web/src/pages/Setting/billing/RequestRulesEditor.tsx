import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui';
import {
  buildRequestRuleExpr, createEmptyCondition, createEmptyRuleGroup, createEmptyTimeCondition,
  getRequestRuleMatchOptions, tryParseRequestRuleExpr,
} from '../../../features/pricing/lib/billing-expr';
import type { RequestCondition, RequestRuleGroup } from '../../../features/pricing/lib/billing-expr';
import { compileBillingExpression } from '../../../features/pricing/lib/billing-expression/parser';
import { TIME_FUNCTIONS } from '../../../features/pricing/lib/billing-expression/types';
import { Input, Select, Textarea, variableLabels } from './controls';

const matchLabels: Record<string, string> = { eq: 'Equals', contains: 'Contains', gt: 'Greater than', gte: 'Greater than or equal', lt: 'Less than', lte: 'Less than or equal', exists: 'Exists', range: 'Time range (may cross midnight)' };
export function requestRuleError(groups: RequestRuleGroup[]): string {
  for (const group of groups) {
    if (group.multiplier.trim() === '' || !Number.isFinite(Number(group.multiplier)) || Number(group.multiplier) < 0) return 'Rule multipliers must be finite non-negative numbers';
    if (!group.conditions.length) return 'Each multiplier rule needs at least one condition';
    for (const condition of group.conditions) {
      if (condition.source === 'time') {
        try { new Intl.DateTimeFormat('en', { timeZone: condition.timezone }).format(); }
        catch { return 'Enter a valid IANA timezone'; }
      }
      if (!buildRequestRuleExpr([{ multiplier: group.multiplier, conditions: [condition] }])) return 'Complete rule conditions with valid values';
    }
  }
  const expression = buildRequestRuleExpr(groups);
  if (groups.length && compileBillingExpression(expression).status !== 'ready') return 'Cannot parse multiplier rules. Check values and conditions.';
  return '';
}

function RuleCondition({ value, onChange }: { value: RequestCondition; onChange: (next: RequestCondition) => void }) {
  const { t } = useTranslation();
  return <div className='min-w-0 space-y-2 rounded-lg border border-ui-border p-3'>
    <Select width='100%' value={value.source} options={[{ value: 'param', label: t('Request body parameter') }, { value: 'header', label: t('Request header') }, { value: 'time', label: t('Request time') }]}
      onChange={(source) => onChange(source === 'time' ? createEmptyTimeCondition() : { ...createEmptyCondition(), source: source as 'param' | 'header' })} />
    {value.source === 'time' ? <>
      <Select width='100%' value={value.timeFunc} options={TIME_FUNCTIONS.map((timeFunc) => ({ value: timeFunc, label: t(variableLabels[timeFunc]) }))}
        onChange={(timeFunc) => onChange({ ...value, timeFunc: timeFunc as typeof value.timeFunc })} />
      <Input aria-label={t('Rule timezone')} value={value.timezone} placeholder='Asia/Shanghai' onChange={(timezone) => onChange({ ...value, timezone })} />
    </> : <Input aria-label={t('Rule parameter path')} value={value.path} placeholder={t(value.source === 'header' ? 'For example, X-Priority' : 'For example, service_tier or metadata.level')} onChange={(path) => onChange({ ...value, path })} />}
    <Select width='100%' value={value.mode} options={getRequestRuleMatchOptions(value.source).map((option) => ({ value: option.value, label: t(matchLabels[option.value] || option.labelKey) }))}
      onChange={(mode) => onChange({ ...value, mode })} />
    {value.source === 'time' && value.mode === 'range' ? <div className='grid grid-cols-2 gap-2'>
      <Input aria-label={t('Time range start')} value={value.rangeStart} placeholder={t('Start (inclusive)')} onChange={(rangeStart) => onChange({ ...value, rangeStart })} />
      <Input aria-label={t('Time range end')} value={value.rangeEnd} placeholder={t('End (exclusive)')} onChange={(rangeEnd) => onChange({ ...value, rangeEnd })} />
    </div> : value.mode !== 'exists' && <Input aria-label={t('Rule match value')} value={value.value} placeholder={t('Match value; numbers and true/false keep their types')} onChange={(next) => onChange({ ...value, value: next })} />}
  </div>;
}

type Props = { value: string; onChange: (value: string) => void; onInvalidChange: (invalid: boolean) => void };
export default function RequestRulesEditor({ value, onChange, onInvalidChange }: Props) {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<RequestRuleGroup[] | null>(() => value ? tryParseRequestRuleExpr(value) : []);
  const [error, setError] = useState('');
  const source = useRef(value);
  const callback = useRef(onInvalidChange); callback.current = onInvalidChange;
  useEffect(() => {
    if (value === source.current) return;
    source.current = value; setGroups(value ? tryParseRequestRuleExpr(value) : []); setError(''); callback.current(false);
  }, [value]);
  useEffect(() => () => callback.current(false), []);
  const update = (next: RequestRuleGroup[]) => {
    setGroups(next);
    const issue = requestRuleError(next); setError(issue); onInvalidChange(!!issue);
    if (!issue) { const expression = buildRequestRuleExpr(next); source.current = expression; onChange(expression); }
  };
  return <details className='min-w-0 space-y-3 rounded-xl border border-ui-border p-3' open={!!groups?.length || groups === null}>
    <summary className='cursor-pointer text-sm font-medium text-ui-text'>{t('Request and time multipliers')}</summary>
    <p className='text-xs text-ui-text-3'>{t('Each matching rule multiplies the price; matching rules compound. Time ranges may cross midnight (21 to 6); Sunday is 0.')}</p>
    {groups === null ? <>
      <p className='text-xs text-ui-text-3'>{t('These rules cannot be represented by the form without changes. The raw rules are preserved.')}</p>
      <Textarea aria-label={t('Raw multiplier rules')} rows={4} value={value} onChange={onChange} />
    </> : <>
      {groups.map((group, index) => <div key={index} className='min-w-0 space-y-3 rounded-xl border border-ui-border p-3'>
        <label className='grid gap-1 text-xs text-ui-text-3'>{t('Rule {{index}} · multiplier', { index: index + 1 })}
          <Input aria-label={t('Rule {{index}} multiplier', { index: index + 1 })} value={group.multiplier} inputMode='decimal' onChange={(multiplier) => update(groups.map((item, i) => i === index ? { ...item, multiplier } : item))} />
        </label>
        {group.conditions.map((condition, conditionIndex) => <div key={conditionIndex} className='min-w-0 space-y-1'>
          <RuleCondition value={condition} onChange={(next) => update(groups.map((item, i) => i === index ? { ...item, conditions: item.conditions.map((c, j) => j === conditionIndex ? next : c) } : item))} />
          <Button size='sm' variant='secondary' onClick={() => update(groups.map((item, i) => i === index ? { ...item, conditions: item.conditions.filter((_, j) => j !== conditionIndex) } : item))}>{t('Remove rule condition')}</Button>
        </div>)}
        <div className='flex flex-wrap gap-2'>
          <Button size='sm' variant='secondary' onClick={() => update(groups.map((item, i) => i === index ? { ...item, conditions: [...item.conditions, createEmptyCondition()] } : item))}>{t('Add rule condition')}</Button>
          <Button size='sm' variant='secondary' onClick={() => update(groups.filter((_, i) => i !== index))}>{t('Remove multiplier rule')}</Button>
        </div>
      </div>)}
      <Button size='sm' variant='secondary' onClick={() => update([...groups, createEmptyRuleGroup()])}>{t('Add multiplier rule')}</Button>
    </>}
    {error && <p role='alert' className='text-xs text-ui-danger'>{t(error)}</p>}
  </details>;
}

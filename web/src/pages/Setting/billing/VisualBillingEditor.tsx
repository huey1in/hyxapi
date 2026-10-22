import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, FormField } from '../../../components/ui';
import {
  createEmptyVisualCondition, parseVisualBillingDocument, serializeVisualBillingDocument, visualNodeId,
} from '../../../features/pricing/lib/billing-expression/visual';
import type { VisualBillingDocument, VisualCondition, VisualPricingNode } from '../../../features/pricing/lib/billing-expression/visual';
import { TIME_FUNCTIONS, TOKEN_VARIABLES } from '../../../features/pricing/lib/billing-expression/types';
import { Input, Select, Textarea, variableLabels } from './controls';

type ConditionProps = { node: VisualCondition; onChange: (node: VisualCondition) => void };
const operators = ['<', '<=', '>', '>=', '==', '!='] as const;

function ConditionEditor({ node, onChange }: ConditionProps) {
  const { t } = useTranslation();
  const wrap = (kind: 'all' | 'any' | 'not') => onChange(kind === 'not'
    ? { id: visualNodeId(), kind, child: node }
    : { id: visualNodeId(), kind, children: [node, createEmptyVisualCondition()] });
  return <div className='min-w-0 space-y-2 rounded-lg border border-ui-border p-3'>
    <div className='flex flex-wrap items-center gap-2'>
      <span className='text-xs text-ui-text-3'>{t(node.kind === 'comparison' ? 'Condition' : node.kind === 'all' ? 'All match' : node.kind === 'any' ? 'Any match' : 'Negated condition')}</span>
      <Button size='sm' variant='secondary' onClick={() => wrap('all')}>{t('Group with AND')}</Button>
      <Button size='sm' variant='secondary' onClick={() => wrap('any')}>{t('Group with OR')}</Button>
      <Button size='sm' variant='secondary' onClick={() => wrap('not')}>{t('Negate')}</Button>
    </div>
    {node.kind === 'comparison' ? <>
      <div className='space-y-2'>
        <FormField label={t('Condition metric')}><Select popover width='100%' value={node.probe} options={['p', 'c', 'len', ...TIME_FUNCTIONS].map((value) => ({ value, label: t(variableLabels[value]) }))}
          onChange={(value) => onChange({ ...node, probe: value as typeof node.probe })} /></FormField>
        <FormField label={t('Comparison operator')}><Select popover width='100%' value={node.operator} options={operators.map((value) => ({ value, label: value }))}
          onChange={(value) => onChange({ ...node, operator: value as typeof node.operator })} /></FormField>
        <Input aria-label={t('Condition threshold')} value={node.value} placeholder={t('Numeric value')} onChange={(value) => onChange({ ...node, value })} />
      </div>
      {TIME_FUNCTIONS.includes(node.probe as typeof TIME_FUNCTIONS[number]) && <label className='grid gap-1 text-xs text-ui-text-3'>{t('IANA timezone')}
        <Input aria-label={t('Condition timezone')} value={node.timezone} placeholder='Asia/Shanghai' onChange={(timezone) => onChange({ ...node, timezone })} />
      </label>}
    </> : node.kind === 'not' ? <>
      <ConditionEditor node={node.child} onChange={(child) => onChange({ ...node, child })} />
      <Button size='sm' variant='secondary' onClick={() => onChange(node.child)}>{t('Remove negation')}</Button>
    </> : <>
      <FormField label={t('Condition type')}><Select popover width='100%' value={node.kind} options={[{ value: 'all', label: t('All conditions (AND)') }, { value: 'any', label: t('Any condition (OR)') }]}
        onChange={(kind) => onChange({ ...node, kind: kind as 'all' | 'any', origin: undefined })} /></FormField>
      {node.children.map((child, index) => <div key={child.id} className='min-w-0 space-y-1'>
        <ConditionEditor node={child} onChange={(next) => onChange({ ...node, children: node.children.map((item, i) => i === index ? next : item) })} />
        <Button size='sm' variant='secondary' onClick={() => onChange({ ...node, children: node.children.filter((_, i) => i !== index) })}>{t('Remove this condition')}</Button>
      </div>)}
      <div className='flex flex-wrap gap-2'>
        <Button size='sm' variant='secondary' onClick={() => onChange({ ...node, children: [...node.children, createEmptyVisualCondition()] })}>{t('Add condition')}</Button>
        {node.children.length === 1 && <Button size='sm' variant='secondary' onClick={() => onChange(node.children[0])}>{t('Ungroup conditions')}</Button>}
      </div>
    </>}
  </div>;
}

function PriceNodeEditor({ node, onChange }: { node: VisualPricingNode; onChange: (node: VisualPricingNode) => void }) {
  const { t } = useTranslation();
  if (node.kind === 'branch') return <div className='min-w-0 space-y-3 rounded-xl border border-ui-border p-3'>
    <p className='text-sm font-medium text-ui-text'>{t('Conditional branch')}</p>
    <ConditionEditor node={node.condition} onChange={(condition) => onChange({ ...node, condition })} />
    <details open className='min-w-0'>
      <summary className='mb-2 cursor-pointer text-xs text-ui-text-3'>{t('When matched')}</summary>
      <PriceNodeEditor node={node.yes} onChange={(yes) => onChange({ ...node, yes })} />
    </details>
    <details open className='min-w-0'>
      <summary className='mb-2 cursor-pointer text-xs text-ui-text-3'>{t('Otherwise')}</summary>
      <PriceNodeEditor node={node.no} onChange={(no) => onChange({ ...node, no })} />
    </details>
    <div className='flex flex-wrap gap-2'>
      <Button size='sm' variant='secondary' onClick={() => onChange(node.yes)}>{t('Keep matched branch only')}</Button>
      <Button size='sm' variant='secondary' onClick={() => onChange(node.no)}>{t('Keep fallback branch only')}</Button>
    </div>
  </div>;

  return <div className='min-w-0 space-y-3 rounded-xl border border-ui-border p-3'>
    <label className='grid gap-1 text-xs text-ui-text-3'>{t('Tier name')}
      <Input aria-label={t('Tier name')} value={node.label} onChange={(label) => onChange({ ...node, label })} />
    </label>
    <FormField label={t('Billing unit')}><Select popover width='100%' value={node.billingUnit} options={[{ value: 'token', label: t('Per token · USD / 1M tokens') }, { value: 'request', label: t('Per request · USD / request') }]}
      onChange={(unit) => onChange({ ...node, billingUnit: unit as 'token' | 'request', origin: undefined, fixedPrice: node.fixedPrice || '0', prices: node.prices.length ? node.prices : [{ variable: 'p', value: '0' }, { variable: 'c', value: '0' }] })} /></FormField>
    {node.billingUnit === 'request' ? <label className='grid gap-1 text-xs text-ui-text-3'>{t('Price per request')}
      <Input aria-label={t('Request price')} value={node.fixedPrice} onChange={(fixedPrice) => onChange({ ...node, fixedPrice })} />
    </label> : <>
      <div className='grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2'>
        {node.prices.map((price, index) => <label key={price.variable} className='grid min-w-0 gap-1 text-xs text-ui-text-3'>
          <span className='flex items-center justify-between gap-2'>{t(variableLabels[price.variable])} · {price.variable}
            <button type='button' className='cursor-pointer text-xs text-ui-text-3' aria-label={t('Remove {{variable}} price', { variable: price.variable })} onClick={() => onChange({ ...node, prices: node.prices.filter((_, i) => i !== index) })}>{t('Remove')}</button>
          </span>
          <Input aria-label={t('{{variable}} unit price', { variable: price.variable })} value={price.value} inputMode='decimal' onChange={(value) => onChange({ ...node, prices: node.prices.map((item, i) => i === index ? { ...item, value } : item) })} />
        </label>)}
      </div>
      <FormField label={t('Add price dimension')}><Select popover width='100%' value='' placeholder={t('Add price dimension')} options={TOKEN_VARIABLES.filter((variable) => variable !== 'len' && !node.prices.some((item) => item.variable === variable)).map((value) => ({ value, label: t(variableLabels[value]) }))}
        onChange={(variable) => onChange({ ...node, prices: [...node.prices, { variable: variable as typeof node.prices[number]['variable'], value: '0' }] })} /></FormField>
    </>}
    <Button size='sm' variant='secondary' onClick={() => onChange({ id: visualNodeId(), kind: 'branch', condition: createEmptyVisualCondition(),
      yes: { ...node, id: visualNodeId(), origin: undefined, label: `${node.label || 'base'}-condition`, prices: node.prices.map(({ variable, value }) => ({ variable, value })) }, no: node })}>{t('Add tier or time branch')}</Button>
  </div>;
}

type Props = { value: string; onChange: (value: string) => void; onInvalidChange: (invalid: boolean) => void };
export default function VisualBillingEditor({ value, onChange, onInvalidChange }: Props) {
  const { t } = useTranslation();
  const [document, setDocument] = useState(() => parseVisualBillingDocument(value));
  const [view, setView] = useState('visual');
  const [issues, setIssues] = useState<string[]>([]);
  const source = useRef(value);
  const callback = useRef(onInvalidChange);
  callback.current = onInvalidChange;
  useEffect(() => {
    if (value === source.current) return;
    source.current = value; setDocument(parseVisualBillingDocument(value)); setIssues([]);
    callback.current(false);
  }, [value]);
  useEffect(() => () => callback.current(false), []);

  const update = (next: VisualBillingDocument) => {
    setDocument(next);
    const serialized = serializeVisualBillingDocument(next);
    if (serialized.ok) {
      setIssues([]); onInvalidChange(false); source.current = serialized.source; onChange(serialized.source);
    } else {
      setIssues(serialized.issues.map((issue) => issue.message)); onInvalidChange(true);
    }
  };
  const visual = view === 'visual' && document !== null;
  return <div aria-label={t('Base billing editor')} className='min-w-0 space-y-3'>
    <FormField label={t('Editor mode')}><Select popover width='100%' value={visual ? 'visual' : 'raw'} options={[
      { value: 'visual', label: t('Visual tiers and time pricing'), disabled: !document }, { value: 'raw', label: t('Raw expression') },
    ]} onChange={setView} /></FormField>
    {!document && value.trim() && <p className='text-xs text-ui-text-3'>{t('This expression cannot be represented visually without changes. The original is preserved for editing and server validation.')}</p>}
    {!value.trim() && <Button size='sm' variant='secondary' onClick={() => { onChange('tier("base", p * 0 + c * 0)'); setView('visual'); }}>{t('Create base price draft')}</Button>}
    {visual ? <PriceNodeEditor node={document.root} onChange={(root) => update({ ...document, root })} /> : <Textarea aria-label={t('Billing expression')} value={value} rows={7} onChange={onChange} />}
    {issues.length > 0 && <div role='alert' className='space-y-2 text-xs text-ui-danger'>
      <p>{t('Correct the visual draft before saving.')}</p>
      {[...new Set(issues)].map((message) => <p key={message}>{t(message)}</p>)}
      <Button size='sm' variant='secondary' onClick={() => { setDocument(parseVisualBillingDocument(value)); setIssues([]); onInvalidChange(false); }}>{t('Discard invalid visual changes')}</Button>
    </div>}
  </div>;
}

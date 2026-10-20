import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { evaluateBillingExpression } from '../../../features/pricing/lib/billing-expression/runtime';
import { compileBillingExpression } from '../../../features/pricing/lib/billing-expression/parser';
import { TIME_FUNCTIONS, TOKEN_VARIABLES } from '../../../features/pricing/lib/billing-expression/types';
import type { TokenVariable } from '../../../features/pricing/lib/billing-expression/types';
import { buildEstimatorTokens } from '../../../features/pricing/lib/tier-expr';
import { Input, Textarea, variableLabels } from './controls';
import { Select } from './controls';
import { Button } from '../../../components/ui';
import type { BillingUsageExample, BillingUsageSchema } from '../../../features/pricing/types';
import { usageLabel, usageUnit } from './usage-labels';

type Props = { expression: string; invalid: boolean; schema?: BillingUsageSchema; examples?: BillingUsageExample[] };
export default function BillingSimulation({ expression, invalid, schema, examples }: Props) {
  const { t, i18n } = useTranslation();
  const [counts, setCounts] = useState<Partial<Record<TokenVariable, number>>>({ p: 1000, c: 500 });
  const [imageCount, setImageCount] = useState(1);
  const [body, setBody] = useState('{}');
  const [headers, setHeaders] = useState('{}');
  const [usage, setUsage] = useState('{}');
  const [time, setTime] = useState('');
  const [tick, setTick] = useState(0);
  const usageObject = useMemo(() => {
    try {
      const value = JSON.parse(usage);
      return value && !Array.isArray(value) && typeof value === 'object' ? value as Record<string, unknown> : null;
    } catch { return null; }
  }, [usage]);
  const setUsageField = (field: string, value: string | number | boolean | undefined) => {
    if (!usageObject) return;
    const next = { ...usageObject };
    if (value === undefined) delete next[field]; else next[field] = value;
    setUsage(JSON.stringify(next, null, 2));
  };
  const compiled = useMemo(() => compileBillingExpression(expression), [expression]);
  const tokens = useMemo(() => ({ ...buildEstimatorTokens(counts.p ?? 0, counts.c ?? 0, {
    cacheReadTokens: counts.cr ?? 0, cacheCreateTokens: counts.cc ?? 0, cacheCreate1hTokens: counts.cc1h ?? 0,
    imageTokens: counts.img ?? 0, imageCacheTokens: counts.img_cr ?? 0, imageOutputTokens: counts.img_o ?? 0,
    audioInputTokens: counts.ai ?? 0, audioOutputTokens: counts.ao ?? 0,
  }), ...counts }), [counts]);
  const usesTime = compiled.status === 'ready' && TIME_FUNCTIONS.some((func) => compiled.functions.has(func));
  useEffect(() => {
    if (!usesTime || time) return;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => { setTick((value) => value + 1); timer = setTimeout(refresh, 60000 - Date.now() % 60000); };
    const visible = () => { if (document.visibilityState === 'visible') { clearTimeout(timer); refresh(); } };
    timer = setTimeout(refresh, 60000 - Date.now() % 60000);
    document.addEventListener('visibilitychange', visible);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', visible); };
  }, [usesTime, time]);
  const simulation = useMemo(() => {
    if (invalid) return { error: t('Correct the visual draft before simulating') };
    try {
      const requestBody: unknown = JSON.parse(body);
      const requestHeaders: unknown = JSON.parse(headers);
      const facts: unknown = JSON.parse(usage);
      if (!requestHeaders || Array.isArray(requestHeaders) || typeof requestHeaders !== 'object' || Object.values(requestHeaders).some((value) => typeof value !== 'string')) throw new Error(t('Headers must be a JSON object with string values'));
      if (!facts || Array.isArray(facts) || typeof facts !== 'object') throw new Error(t('Task usage must be a JSON object'));
      for (const [field, definition] of Object.entries(schema || {})) {
        const value = (facts as Record<string, unknown>)[field];
        if (value === undefined) continue;
        if (definition.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) throw new Error(t('{{field}} must be a finite non-negative number', { field }));
        if (definition.type === 'boolean' && typeof value !== 'boolean') throw new Error(t('{{field}} must be true or false', { field }));
        if (!definition.type && typeof value !== 'string') throw new Error(t('{{field}} must be a string', { field }));
        if (definition.enum && !definition.enum.includes(String(value))) throw new Error(t('{{field}} is not an allowed plugin value', { field }));
      }
      let now: Date | undefined;
      if (time) {
        now = new Date(time);
        if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(time) || !Number.isFinite(now.getTime())) throw new Error(t('Simulation time must be ISO format with a timezone offset'));
      }
      if (Object.values(counts).some((count) => !Number.isFinite(count) || Number(count) < 0) || !Number.isFinite(imageCount) || imageCount < 0) throw new Error(t('Usage must be finite and non-negative'));
      const result = evaluateBillingExpression(expression, { tokens, imageCount, request: { body: requestBody, headers: requestHeaders as Record<string, string> }, usage: facts as Record<string, unknown>, now });
      if (result.status !== 'success') return { error: t('Browser simulation unavailable: {{detail}}', { detail: result.diagnostic.detail }) };
      const task = compiled.status === 'ready' && compiled.functions.has('u');
      return { result, cost: result.cost / (task || result.billingUnit === 'request' ? 1 : 1_000_000) };
    } catch (cause) { return { error: cause instanceof Error ? cause.message : String(cause) }; }
  }, [expression, invalid, body, headers, usage, time, tick, counts, tokens, imageCount, compiled, schema, t]);

  return <details className='min-w-0 space-y-3 rounded-xl border border-ui-border p-3'>
    <summary className='cursor-pointer text-sm font-medium text-ui-text'>{t('Request simulation')}</summary>
    <p className='text-xs text-ui-text-3'>{t('Simulates the full expression and request multipliers, excluding group multipliers and quota rounding.')}{' '}
      {t(schema ? 'Task usage comes from plugin reports. Unfilled fields stay unknown; booleans retain true/false types.' : 'These are billable counts; cache is not subtracted from input automatically. len totals input dimensions by default; clear it to restore automatic calculation.')}</p>
    {(!schema || (compiled.status === 'ready' && compiled.variables.size > 0)) && <div className='grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3'>
      {TOKEN_VARIABLES.map((variable) => <label key={variable} className='grid min-w-0 gap-1 text-xs text-ui-text-3'>{t(variableLabels[variable])} · {variable}
        <Input aria-label={t('Simulation usage {{variable}}', { variable })} type='number' min={0} value={Number.isNaN(tokens[variable]) ? '' : String(tokens[variable] ?? 0)} onChange={(value) => setCounts((current) => {
          const next = { ...current };
          if (variable === 'len' && value === '') delete next.len;
          else next[variable] = value === '' ? Number.NaN : Number(value);
          return next;
        })} />
      </label>)}
      <label className='grid min-w-0 gap-1 text-xs text-ui-text-3'>{t('Actual image count')}
        <Input aria-label={t('Simulation image count')} type='number' min={0} value={Number.isNaN(imageCount) ? '' : String(imageCount)} onChange={(value) => setImageCount(value === '' ? Number.NaN : Number(value))} />
      </label>
    </div>}
    {schema && <>
      {Boolean(examples?.length) && <div className='flex flex-wrap gap-2'>
        {(examples ?? []).map((example, index) => <Button key={index} variant='secondary' size='sm' onClick={() => setUsage(JSON.stringify(example.facts, null, 2))}>{t('Example: {{label}}', { label: example.label })}</Button>)}
      </div>}
      <div className='grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2'>
        {Object.entries(schema).map(([field, definition]) => <label key={field} className='grid min-w-0 gap-1 text-xs text-ui-text-3'>
          {usageLabel(definition.description, field, i18n.language)} · {field}{definition.unit ? ` (${usageUnit(definition, i18n.language, t)})` : ''}
          {definition.type === 'boolean' ? <Select disabled={!usageObject} width='100%' value={usageObject?.[field] === undefined ? '' : String(usageObject[field])}
            options={[{ value: '', label: t('Unspecified') }, { value: 'true', label: 'true' }, { value: 'false', label: 'false' }]}
            onChange={(value) => setUsageField(field, value === '' ? undefined : value === 'true')} />
            : definition.enum ? <Select disabled={!usageObject} width='100%' value={String(usageObject?.[field] ?? '')}
              options={[{ value: '', label: t('Unspecified') }, ...definition.enum.map((value) => ({ value, label: usageLabel(definition.enumLabels?.[value], value, i18n.language) }))]}
              onChange={(value) => setUsageField(field, value === '' ? undefined : value)} />
              : <Input aria-label={t('Simulation task field {{field}}', { field })} disabled={!usageObject} type={definition.type === 'number' ? 'number' : 'text'} min={0} step='any'
                value={String(usageObject?.[field] ?? '')} placeholder={t('Unspecified')} onChange={(value) => setUsageField(field, value === '' ? undefined : definition.type === 'number' ? Number(value) : value)} />}
        </label>)}
      </div>
      {!usageObject && <p role='status' className='text-xs text-ui-danger'>{t('Correct the task usage JSON below before using the field form.')}</p>}
    </>}
    <label className='grid gap-1 text-xs text-ui-text-3'>{t('Request body JSON')}
      <Textarea aria-label={t('Simulation request body')} value={body} rows={4} onChange={setBody} />
    </label>
    <label className='grid gap-1 text-xs text-ui-text-3'>{t('Request headers JSON')}
      <Textarea aria-label={t('Simulation request headers')} value={headers} rows={3} onChange={setHeaders} />
    </label>
    <label className='grid gap-1 text-xs text-ui-text-3'>{t('Task usage JSON (preserves booleans, strings and numbers)')}
      <Textarea aria-label={t('Simulation task usage')} value={usage} rows={3} onChange={setUsage} />
    </label>
    <label className='grid gap-1 text-xs text-ui-text-3'>{t('Simulation time (blank uses current time)')}
      <Input aria-label={t('Simulation time')} value={time} placeholder='2026-10-18T21:30:00+08:00' onChange={setTime} />
    </label>
    <div aria-live='polite' aria-label={t('Billing simulation result')} className='space-y-2 text-xs text-ui-text-2'>
      {'error' in simulation ? <p role='status'>{simulation.error}</p> : <>
        <p>{t('Cost per request')}：<strong>USD {simulation.cost?.toLocaleString(i18n.language, { maximumFractionDigits: 12 })}</strong></p>
        <p>{t('Matched tier')}：{simulation.result?.matchedTier || t('Unlabelled')}</p>
        {simulation.result?.requestRules.map((rule, index) => <p key={index} className='break-words'>{t('Rule {{index}}', { index: index + 1 })}: {rule.matched ? t('Matched × {{multiplier}}', { multiplier: rule.multiplier }) : t('未命中')} · {rule.cond}</p>)}
      </>}
    </div>
  </details>;
}

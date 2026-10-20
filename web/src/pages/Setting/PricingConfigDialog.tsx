import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { API } from '../../helpers';
import type { ApiEnvelope } from '../../types/api';
import { useAuthStore } from '../../stores/auth-store';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { Button, Input, Modal, Select, showSuccess } from '../../components/ui';
import { combineBillingExpr, splitBillingExprAndRequestRules } from '../../features/pricing/lib/billing-expr';
import VisualBillingEditor from './billing/VisualBillingEditor';
import RequestRulesEditor from './billing/RequestRulesEditor';
import BillingSimulation from './billing/BillingSimulation';
import TaskBillingEditor from './billing/TaskBillingEditor';
import { createDefaultTaskVisualConfig, generateTaskExprFromConfig } from '../../features/pricing/lib/task-expr';
import type { PricingEntry as Entry, PricingValues as Values } from './billing/pricing-config';
import { pricingConversionSchema, pricingPreviewSchema, pricingSnapshotSchema, validatePricingDraft } from './billing/pricing-config';
import { getModelPricingErrorMessage } from './pricing-editor';

type Props = { modelName: string | null; onClose: () => void; onSaved: () => void };
const modeKey = 'billing_setting.billing_mode';
const exprKey = 'billing_setting.billing_expr';
const pluginKey = 'billing_setting.plugin_billing_expr';
const conversionReadyMessage = 'Conversion added to the draft. Save to apply it.';
const requestConfig = { skipErrorHandler: true, disableDuplicate: true, timeout: 15000 };
const fields = [
  ['ModelRatio', 'Input ratio'], ['CompletionRatio', 'Output / input ratio'],
  ['CacheRatio', 'Cache read ratio'], ['CreateCacheRatio', 'Cache write ratio'],
  ['ImageRatio', 'Image input ratio'], ['AudioRatio', 'Audio input ratio'],
  ['AudioCompletionRatio', 'Audio output / input ratio'], ['ModelPrice', 'USD per request'],
];

function PricingConfigContent({ modelName, onClose, onSaved }: Omit<Props, 'modelName'> & { modelName: string }) {
  const { t } = useTranslation();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [draft, setDraft] = useState<Values>({});
  const { busy, run } = useOwnedOperation();
  const [generation, setGeneration] = useState(0);
  const [preview, setPreview] = useState<string>('');
  const [loadedName, setLoadedName] = useState('');
  const [error, setError] = useState('');
  const [invalidEditors, setInvalidEditors] = useState({ base: false, rules: false });
  const [selectedPlugin, setSelectedPlugin] = useState('');
  const mode = String(draft[modeKey] || 'inherit');
  const modelExpression = String(draft[exprKey] ?? entry?.effective[exprKey] ?? '');
  const variant = entry?.plugin_variants?.find((item) => item.plugin_key === selectedPlugin);
  const savedOverrides = draft[pluginKey];
  const overrides = typeof savedOverrides === 'object' ? savedOverrides : {};
  const overridden = Boolean(variant && Object.hasOwn(overrides, variant.plugin_key));
  const modelUsesExpression = (draft[modeKey] || entry?.effective[modeKey]) === 'tiered_expr';
  const expression = variant ? overrides[variant.plugin_key] ?? (modelUsesExpression ? modelExpression : '') : modelExpression;
  const schema = variant?.usage_schema || entry?.usage_schema || {};
  const task = Boolean(variant || Object.keys(schema).length > 0 || entry?.plugin_variants?.length);
  const expressionParts = useMemo(() => splitBillingExprAndRequestRules(expression), [expression]);
  const draftError = entry ? validatePricingDraft(draft) : '';
  const invalid = invalidEditors.base || invalidEditors.rules || Boolean(draftError);

  useEffect(() => {
    const owner = new AbortController();
    setEntry(null); setPreview(''); setError(''); setLoadedName(''); setInvalidEditors({ base: false, rules: false }); setSelectedPlugin('');
    setDraft({});
    API.get<ApiEnvelope<unknown>>(`/api/option/model_pricing?model=${encodeURIComponent(modelName)}`, { ...requestConfig, signal: owner.signal })
      .then(({ data }) => {
        if (owner.signal.aborted) return;
        if (!data.success) throw new Error(data.message || 'Unable to load pricing');
        const parsed = pricingSnapshotSchema.safeParse(data.data);
        if (!parsed.success) throw new Error('Unable to load pricing');
        const next = parsed.data.entries.find((item) => item.model_name === modelName);
        if (!next) throw new Error('Unable to load pricing');
        setEntry(next); setDraft({ ...next.configured }); setLoadedName(modelName);
      })
      .catch((cause: unknown) => { if (!owner.signal.aborted) setError(getModelPricingErrorMessage(cause, 'Unable to load pricing')); });
    return () => owner.abort();
  }, [modelName, generation]);

  const update = (key: string, value: Values[string] | undefined) => {
    setPreview(''); setError('');
    setDraft((current) => {
      const next = { ...current };
      if (value === undefined) delete next[key]; else next[key] = value;
      return next;
    });
  };
  const updateExpression = (value: string) => {
    if (variant) update(pluginKey, { ...overrides, [variant.plugin_key]: value });
    else update(exprKey, value);
  };
  const overridePlugin = (remove = false) => {
    if (!variant) return;
    setError(''); setPreview(''); setInvalidEditors({ base: false, rules: false });
    setDraft((current) => {
      const next = { ...current };
      const expressions = { ...(typeof current[pluginKey] === 'object' ? current[pluginKey] : {}) };
      if (remove) delete expressions[variant.plugin_key];
      else {
        expressions[variant.plugin_key] = expression || generateTaskExprFromConfig(createDefaultTaskVisualConfig(schema), schema) || 'tier("base", 0)';
        // Preserve explicit USD precedence until the administrator chooses to
        // enable an override. Ratio remains the fallback for other providers.
        if (entry?.direct && !current[modeKey]) next[modeKey] = 'ratio';
      }
      if (Object.keys(expressions).length) next[pluginKey] = expressions;
      else delete next[pluginKey];
      return next;
    });
  };
  const runPreview = (convert: boolean, source?: string) => {
    if (!entry) return;
    if (invalid) { setError('Fix or discard invalid visual changes first.'); return; }
    setError('');
    void run(async (signal) => { try {
      const { data } = await API.post<ApiEnvelope<unknown>>(`/api/option/model_pricing/${convert ? 'convert' : 'preview'}`, {
        model_name: entry.model_name, pricing: draft, source,
      }, { ...requestConfig, signal });
      signal.throwIfAborted();
      if (!data.success) throw new Error(data.message || 'Unable to validate pricing');
      if (convert) {
        const parsed = pricingConversionSchema.safeParse(data.data);
        if (!parsed.success) throw new Error('Unable to validate pricing');
        if (parsed.data.unsupported_reason) throw new Error(parsed.data.unsupported_reason);
        const convertedExpression = parsed.data.expression;
        if (!convertedExpression?.trim()) throw new Error('Unable to validate pricing');
        setDraft((current) => ({ ...current, [modeKey]: 'tiered_expr', [exprKey]: convertedExpression }));
        setPreview(conversionReadyMessage);
      } else {
        const parsed = pricingPreviewSchema.safeParse(data.data);
        if (!parsed.success) throw new Error('Unable to validate pricing');
        setPreview(JSON.stringify(parsed.data, null, 2));
      }
    } catch (cause: unknown) { if (!signal.aborted) setError(getModelPricingErrorMessage(cause, 'Unable to validate pricing')); } });
  };
  const save = (reset = false) => {
    if (!entry || loadedName !== modelName) return;
    if (!reset && invalid) { setError('Fix or discard invalid visual changes first.'); return; }
    setError('');
    void run(async (signal) => { try {
      const { data } = await API.patch<ApiEnvelope<unknown>>('/api/option/model_pricing', {
        changes: [{ model_name: entry.model_name, expected_version: entry.version, pricing: draft, reset }],
      }, { ...requestConfig, signal });
      signal.throwIfAborted();
      if (!data.success) throw new Error(data.message || 'Unable to save pricing');
      showSuccess(t(reset ? 'Upstream defaults restored' : 'Pricing saved')); onSaved(); onClose();
    } catch (cause: unknown) {
      if (signal.aborted) return;
      setError(isAxiosError(cause) && cause.response?.status === 409
        ? 'Pricing changed in another session. Reopen and merge your changes.'
        : getModelPricingErrorMessage(cause, 'Unable to save pricing'));
    } });
  };

  return (
    <Modal open onClose={() => !busy && onClose()} title={t('Advanced billing · {{model}}', { model: modelName })} width={780} onConfirm={() => save()}
      footer={<div className='flex w-full flex-wrap justify-end gap-2.5'><Button variant='secondary' disabled={busy || !entry} onClick={() => save(true)}>{t('Restore upstream defaults')}</Button>
        <Button variant='secondary' disabled={busy} onClick={onClose}>{t('Cancel')}</Button>
        <Button loading={busy} disabled={!entry || loadedName !== modelName || invalid} onClick={() => save()}>{t('Save billing configuration')}</Button></div>}>
      {(error || draftError) && <div role='alert' className='text-sm text-ui-danger'>{t(error || draftError)}</div>}
      {!entry ? <div className='text-sm text-ui-text-3'>{error ? <Button variant='secondary' onClick={() => setGeneration((current) => current + 1)}>{t('Retry')}</Button> : t('Loading pricing…')}</div> : <>
        <p className='text-xs text-ui-text-3'>{t('Effective pricing')}: {t(entry.source === 'direct' ? 'Direct prices' : entry.source === 'tiered_expr' ? 'Expression billing' : 'Ratio billing')}.{' '}
          {t('An explicit billing mode overrides direct prices. Inherit configuration to use direct prices again.')}</p>
        <label className='grid gap-1.5 text-xs text-ui-text-3'>{t('Billing mode')}
          <Select aria-label={t('Billing mode')} disabled={busy || invalidEditors.base || invalidEditors.rules || Boolean(variant)} value={mode} options={[
            { value: 'inherit', label: t(entry.direct ? 'Inherit configuration (direct prices first)' : 'Automatic (current configuration)') },
            { value: 'ratio', label: t('Ratio billing') }, { value: 'tiered_expr', label: t('Expression billing') },
          ]} onChange={(value: string) => update(modeKey, value === 'inherit' ? undefined : value)} />
        </label>
        {Boolean(entry.plugin_variants?.length) && <label className='grid gap-1.5 text-xs text-ui-text-3'>{t('Pricing target')}
          <Select aria-label={t('Pricing target')} disabled={busy || invalidEditors.base || invalidEditors.rules} value={selectedPlugin} options={[
            { value: '', label: t('Model default (inherited by plugins without overrides)') },
            ...(entry.plugin_variants ?? []).map((item) => ({ value: item.plugin_key, label: `${item.plugin_name} · ${item.plugin_key}${item.stale ? ` ${t('(inactive)')}` : ''}` })),
          ]} onChange={(value: string) => { setSelectedPlugin(value); setPreview(''); setError(''); }} />
        </label>}
        {variant && <div className='space-y-2 text-xs text-ui-text-3'>
          <p>{t(overridden ? 'This plugin has its own expression. Other plugins keep their own prices.' : 'This plugin inherits model pricing. Create an override to price its usage fields.')}{' '}
            {entry.direct && mode === 'inherit' ? t('A plugin override enables an explicit billing mode and replaces direct prices.') : ''}</p>
          {variant.stale && <p role='status'>{t('This plugin was removed or no longer declares this model. Its override is preserved; restore inheritance to remove it.')}</p>}
          {!variant.stale && !variant.compatible && expression && <p>{t('Validate the expression against this plugin’s usage fields before saving.')}</p>}
          {overridden ? <Button disabled={busy} variant='secondary' size='sm' onClick={() => overridePlugin(true)}>{t('Restore plugin inheritance')}</Button>
            : !variant.stale && <Button disabled={busy} variant='secondary' size='sm' onClick={() => overridePlugin()}>{t('Set plugin pricing')}</Button>}
        </div>}
        {variant && (!overridden || variant.stale) ? <>
          <pre aria-label={t('Inherited plugin expression')} className='whitespace-pre-wrap break-all text-xs text-ui-text-2'>{expression || t('Expression billing is not active.')}</pre>
          {expression && <BillingSimulation key={`inherited-simulation-${selectedPlugin}`} expression={expression} invalid={false} schema={schema} examples={variant.usage_examples} />}
        </> : mode === 'tiered_expr' || variant ? <>
          <fieldset disabled={busy} className='min-w-0 space-y-3'>
          {task ? <TaskBillingEditor key={`billing-${selectedPlugin || 'model'}`} value={expressionParts.billingExpr} schema={schema}
            onChange={(value) => updateExpression(combineBillingExpr(value, expressionParts.requestRuleExpr))}
            onInvalidChange={(value) => setInvalidEditors((current) => current.base === value ? current : { ...current, base: value })} />
            : <VisualBillingEditor value={expressionParts.billingExpr}
              onChange={(value) => updateExpression(combineBillingExpr(value, expressionParts.requestRuleExpr))}
              onInvalidChange={(value) => setInvalidEditors((current) => current.base === value ? current : { ...current, base: value })} />}
          {!task && <p className='text-xs text-ui-text-3'>{t('p/c are input/output; cr/cc/cc1h are cache read/write; ai/ao are audio. Coefficients are USD per 1M tokens.')}{' '}
            {t('Use tier("request", fixed(USD)) per request, or multiply by image_count per image. Tiers, request fields and time conditions are supported.')}</p>
          }
          <RequestRulesEditor key={`rules-${selectedPlugin || 'model'}`} value={expressionParts.requestRuleExpr}
            onChange={(value) => updateExpression(combineBillingExpr(expressionParts.billingExpr, value))}
            onInvalidChange={(value) => setInvalidEditors((current) => current.rules === value ? current : { ...current, rules: value })} />
          <BillingSimulation key={`simulation-${selectedPlugin || 'model'}`} expression={expression} invalid={invalid} schema={task ? schema : undefined} examples={variant?.usage_examples} />
          </fieldset>
        </> : <>
          <p className='text-xs text-ui-text-3'>{t('Leave blank to inherit; 0 is free. Per-request pricing disables token ratio billing.')}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {fields.map(([key, label]) => <label key={key} className='grid gap-1.5 text-xs text-ui-text-3'>{t(label)}
              <Input aria-label={t(label)} disabled={busy} type='number' min={0} step='any' value={draft[key] === undefined ? '' : String(draft[key])}
                invalid={draft[key] !== undefined && (typeof draft[key] !== 'number' || !Number.isFinite(draft[key]) || Number(draft[key]) < 0)}
                placeholder={entry.effective[key] === undefined ? t('Default') : String(entry.effective[key])}
                onChange={(value: string) => update(key, value === '' ? undefined : Number(value))} />
            </label>)}
          </div>
        </>}
        <div className='flex flex-wrap gap-2'>
          <Button size='sm' variant='secondary' disabled={busy || invalid} onClick={() => runPreview(false)}>{t('Validate and preview')}</Button>
          {!variant && <Button size='sm' variant='secondary' disabled={busy || invalid || mode === 'tiered_expr'} onClick={() => runPreview(true)}>{t('Convert ratios to expression')}</Button>}
          {!variant && entry.direct && <Button size='sm' variant='secondary' disabled={busy || invalid} onClick={() => runPreview(true, 'direct')}>{t('Convert direct prices')}</Button>}
        </div>
        {preview && <pre aria-label={t('Pricing preview')} className='whitespace-pre-wrap break-all text-xs text-ui-text-2' style={{ maxHeight: 240, overflowY: 'auto' }}>{preview === conversionReadyMessage ? t(conversionReadyMessage) : preview}</pre>}
      </>}
    </Modal>
  );
}

export default function PricingConfigDialog(props: Props) {
  const auth = useAuthStore((state) => state.auth);
  if (!props.modelName) return null;
  return <PricingConfigContent key={`${auth.user?.id}:${auth.session?.sid}:${auth.user?.role}:${props.modelName}`} {...props} modelName={props.modelName} />;
}

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BadgeDollarSign, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { API, showSuccess } from '../../helpers';
import { Button, Checkbox, ConfirmDialog, EmptyState, FormField, Input, Modal, NumberInput, Pagination, Select, Switch, ContentSkeleton } from '../../components/ui';
import { useAuthStore } from '../../stores/auth-store';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { apiErrorMessage } from '../../lib/api-error';
import type { ApiEnvelope } from '../../types/api';
import PricingConfigDialog from './PricingConfigDialog';
import PricingBatchDialog from './billing/PricingBatchDialog';
import PricingSync from '../../features/pricing-sync';
import {
  TOKEN_BILLING, REQUEST_BILLING, DEFAULT_PAGE_SIZE, MODEL_PRICING_ROWS_STYLE, MODEL_PRICING_ROW_STYLE,
  directPriceSchema, directPriceListSchema, pricingSummarySchema, upstreamPricePreviewSchema,
  createBlankPricingRow, getModelName, mergePricingRowsWithModels, mergeRefreshedPricingRows, replacePricingRow, removePricingRow,
  clampModelPricingPage, getModelPricingPageRows, getBillingTypeOptions, getDefaultModelPricingSyncSelection,
  buildModelPricingSyncPayload, toModelPricingPayload, validatePricingRow,
} from './pricing-editor';
import type { DirectPrice, PriceField, PricingRow, PricingSuggestion, SyncPreview } from './pricing-editor';
import Skeleton from '../../components/ui/feedback/Skeleton';

const tokenFields: [PriceField, string][] = [['input_price', 'Input'], ['output_price', 'Output'], ['cache_read_price', 'Cache read'], ['cache_write_price', 'Cache write'], ['image_price', 'Image'], ['audio_input_price', 'Audio input'], ['audio_output_price', 'Audio output']];

function PricingRowsSkeleton() {
  const { t } = useTranslation();
  return <ContentSkeleton variant='form'><div style={MODEL_PRICING_ROWS_STYLE}>{[0, 1, 2].map((index) => <div key={index} style={MODEL_PRICING_ROW_STYLE} className='grid gap-3 border-t border-ui-border py-4'>
    <div className='grid grid-cols-[minmax(220px,1fr)_minmax(130px,170px)_auto_auto] items-end gap-3'>{['Model name', 'Billing type', 'Enabled', 'Save'].map((label) => <div key={label} className='grid min-w-0 gap-1 text-[11px] text-ui-text-3'>{t(label)}<Skeleton width={label === 'Save' ? 160 : '100%'} height={36} rounded='rounded-full' /></div>)}</div>
    <div className='grid grid-cols-[repeat(auto-fit,minmax(138px,1fr))] gap-2.5'>{tokenFields.map(([key, label]) => <div key={key} className='grid min-w-0 gap-1 text-[11px] text-ui-text-3'>{t(label)} · USD / 1M<Skeleton height={36} rounded='rounded-full' /></div>)}</div>
  </div>)}</div></ContentSkeleton>;
}

function PricingWorkspace({ modelSuggestions, identity }: { modelSuggestions: PricingSuggestion[]; identity: string }) {
  const { t } = useTranslation();
  const { busy, run } = useOwnedOperation();
  const [rows, setRows] = useState<PricingRow[]>([]);
  const [savingId, setSavingId] = useState('');
  const [advancedModel, setAdvancedModel] = useState<string | null>(null);
  const [advancedTarget, setAdvancedTarget] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [preview, setPreview] = useState<SyncPreview[] | null>(null);
  const [selectedSyncModels, setSelectedSyncModels] = useState<string[]>([]);
  const [batchOpen, setBatchOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [deleting, setDeleting] = useState<PricingRow | null>(null);
  const names = useMemo(() => [...new Set(modelSuggestions.map(getModelName).filter(Boolean))].sort(), [modelSuggestions]);
  const prices = useQuery({
    queryKey: ['managed-direct-prices', identity], gcTime: 0, retry: false, refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const [direct, advanced] = await Promise.all([
        API.get<ApiEnvelope<unknown>>('/api/model-pricing', { signal, skipErrorHandler: true, disableDuplicate: true }),
        API.get<ApiEnvelope<unknown>>('/api/option/model_pricing', { signal, skipErrorHandler: true, disableDuplicate: true }),
      ]);
      signal.throwIfAborted();
      if (!direct.data.success || !advanced.data.success) throw new Error(direct.data.message || advanced.data.message || 'Unable to load model prices');
      const next = directPriceListSchema.safeParse(direct.data.data); const summary = pricingSummarySchema.safeParse(advanced.data.data);
      if (!next.success || !summary.success) throw new Error('Unable to load model prices');
      return { rows: next.data, entries: Object.fromEntries(summary.data.entries.map((entry) => [entry.model_name, entry])) };
    },
  });
  useEffect(() => { if (prices.data) setRows((current) => mergeRefreshedPricingRows(current, prices.data.rows, [])); }, [prices.data]);
  // Suggestions can arrive after a save. Add them without reapplying an older
  // cached server snapshot over the price that was just saved.
  useEffect(() => { setRows((current) => mergePricingRowsWithModels(current, names)); }, [names, prices.data]);
  useEffect(() => { setPage((current) => clampModelPricingPage(current, rows.length, pageSize)); }, [rows.length, pageSize]);
  const unavailable = prices.isFetching || !!prices.error || !prices.data;
  const visible = getModelPricingPageRows(rows, page, pageSize);
  const entries = prices.data?.entries ?? {};
  const refresh = () => { void prices.refetch(); };
  const update = <K extends keyof PricingRow>(key: string, field: K, value: PricingRow[K]) => setRows((current) => current.map((row) => row._key === key ? { ...row, [field]: value, _dirty: true } : row));
  const save = (row: PricingRow) => run(async (signal) => {
    const invalid = validatePricingRow(row); if (invalid) throw new Error(invalid);
    setSavingId(row._key);
    try {
      const { data } = await API.post<ApiEnvelope<unknown>>('/api/model-pricing', toModelPricingPayload(row), { signal, skipErrorHandler: true });
      signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to save model price');
      const result = directPriceSchema.safeParse(data.data); if (!result.success) throw new Error('Unable to save model price');
      setRows((current) => replacePricingRow(current, row._key, result.data));
      showSuccess(t(entries[row.model_name]?.configured['billing_setting.billing_mode'] ? 'Direct price saved. Advanced billing remains active.' : 'Model price saved'));
    } finally { if (!signal.aborted) setSavingId(''); }
  });
  const remove = (row: PricingRow) => {
    if (row._new || !row.id) setRows((current) => removePricingRow(current, row._key));
    else setDeleting(row);
  };
  const deleteConfirmed = () => run(async (signal) => {
    if (!deleting) return;
    const { data } = await API.delete<ApiEnvelope<unknown>>(`/api/model-pricing/${deleting.id}`, { signal, skipErrorHandler: true });
    signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to delete model price');
    setRows((current) => removePricingRow(current, deleting._key)); setDeleting(null); showSuccess(t('Model price deleted'));
  });
  const previewSync = () => run(async (signal) => {
    const { data } = await API.post<ApiEnvelope<unknown>>('/api/model-pricing/sync/preview', {}, { signal, skipErrorHandler: true });
    signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to preview upstream prices');
    const result = upstreamPricePreviewSchema.safeParse(data.data); if (!result.success) throw new Error('Unable to preview upstream prices');
    if (!result.data.length) { showSuccess(t('Model prices are up to date')); return; }
    setPreview(result.data); setSelectedSyncModels(getDefaultModelPricingSyncSelection(result.data));
  });
  const applySync = () => run(async (signal) => {
    const payload = buildModelPricingSyncPayload(preview ?? [], selectedSyncModels); if (!payload.model_names.length) throw new Error('Select models to synchronize');
    const { data } = await API.post<ApiEnvelope<{ saved?: number }>>('/api/model-pricing/sync/apply', payload, { signal, skipErrorHandler: true });
    signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to synchronize upstream prices');
    setPreview(null); showSuccess(t('Synchronized {{count}} model prices', { count: data.data?.saved ?? payload.model_names.length })); refresh();
  });
  const priceText = (price: DirectPrice | null) => price ? t('Input ${{input}} · Output ${{output}} · Cache read ${{read}} · Cache write ${{write}}', { input: price.input_price, output: price.output_price, read: price.cache_read_price, write: price.cache_write_price }) : t('Not configured');
  return <section aria-label={t('Model base prices')} className='grid min-w-0 gap-3.5'>
    <datalist id='model-pricing-suggestions'>{[...new Set([...names, ...Object.keys(entries)])].sort().map((name) => <option key={name} value={name} />)}</datalist>
    <div className='flex flex-wrap items-center justify-between gap-3'>
      <div className='min-w-0'><h2 className='text-[15px] font-semibold text-ui-text'>{t('Model base prices')}</h2><p className='mt-1 text-xs leading-relaxed text-ui-text-3'>{t('Token prices use USD per 1M tokens; request prices use USD per request. Group multipliers apply separately.')}</p></div>
      <div className='flex flex-wrap items-center gap-2'>
        <Button size='sm' variant='secondary' icon={RefreshCw} loading={busy && !savingId} disabled={unavailable || busy} onClick={() => void previewSync()}>{t('Synchronize upstream prices')}</Button>
        <Button size='sm' variant='secondary' icon={RefreshCw} loading={prices.isFetching} disabled={busy} onClick={refresh}>{t('Refresh')}</Button>
        <Button size='sm' icon={Plus} disabled={unavailable || busy} onClick={() => { setRows((current) => [createBlankPricingRow(), ...current]); setPage(1); }}>{t('Add price')}</Button>
      </div>
    </div>
    <div className='flex flex-wrap items-center gap-2'>
      <Input aria-label={t('Advanced billing model')} value={advancedTarget} list='model-pricing-suggestions' placeholder={t('Enter a model for tiered, scheduled, or expression billing')} onChange={setAdvancedTarget} />
      <Button size='sm' variant='secondary' disabled={!advancedTarget.trim() || unavailable || busy} onClick={() => setAdvancedModel(advancedTarget.trim())}>{t('Advanced billing configuration')}</Button>
      <Button size='sm' variant='secondary' disabled={unavailable || busy} onClick={() => setBatchOpen(true)}>{t('Batch billing management')}</Button>
      <Button size='sm' variant='secondary' disabled={unavailable || busy} onClick={() => setSyncOpen(true)}>{t('Upstream price synchronization')}</Button>
    </div>
    {prices.isPending ? <PricingRowsSkeleton /> : prices.error ? <div role='alert' className='space-y-3 text-sm'><p>{t(apiErrorMessage(prices.error, 'Unable to load model prices'))}</p><Button variant='toggle' onClick={refresh}>{t('Retry')}</Button></div> : <>
      {!rows.length && <div className='border-y border-ui-border px-4'><EmptyState icon={BadgeDollarSign} padding='sm' title={t('No model prices configured')} /></div>}
      <div style={MODEL_PRICING_ROWS_STYLE}><div className='grid'>{visible.map((row) => <fieldset key={row._key} aria-label={t('Price for {{model}}', { model: row.model_name || t('New model') })} disabled={busy || prices.isFetching} style={MODEL_PRICING_ROW_STYLE} className='grid gap-3 border-t border-ui-border py-4'>
        <div className='grid grid-cols-[minmax(220px,1fr)_minmax(260px,320px)_auto_auto] items-end gap-3'>
          <label className='grid min-w-0 gap-1 text-[11px] text-ui-text-3'>{t('Model name (supports leading or trailing *)')}<Input aria-label={t('Model name')} value={row.model_name} list='model-pricing-suggestions' onChange={(value) => update(row._key, 'model_name', value)} /></label>
          <FormField label={t('Billing type')}><Select popover aria-label={t('Billing type')} disabled={busy} value={row.billing_type} options={getBillingTypeOptions(row.billing_type).map((option) => ({ ...option, label: option.value === TOKEN_BILLING || option.value === REQUEST_BILLING ? t(option.label) : t('Invalid type ({{type}})', { type: option.value }) }))} onChange={(value) => update(row._key, 'billing_type', value)} /></FormField>
          <label className='flex h-9 items-center gap-2 text-sm text-ui-text-2'><Switch size='sm' disabled={busy} checked={row.enabled} onChange={(value) => update(row._key, 'enabled', value)} aria-label={t('Enable model price')} />{t('Enabled')}</label>
          <div className='flex h-9 items-center gap-2'><Button size='sm' icon={Save} loading={busy && savingId === row._key} disabled={!row._dirty || busy} onClick={() => void save(row)}>{t('Save')}</Button><Button size='sm' variant='secondary' disabled={!row.model_name.trim() || busy} onClick={() => setAdvancedModel(row.model_name.trim())}>{t('Advanced billing')}</Button><Button size='sm' variant='secondary' icon={Trash2} disabled={busy} onClick={() => remove(row)}>{t('Delete')}</Button></div>
        </div>
        {!!entries[row.model_name]?.configured['billing_setting.billing_mode'] && <p className='text-xs text-ui-text-3'>{t('Advanced billing is active. These direct prices remain a fallback until the billing configuration changes.')}</p>}
        <div className={row.billing_type === REQUEST_BILLING ? 'grid max-w-64' : 'grid grid-cols-[repeat(auto-fit,minmax(138px,1fr))] gap-2.5'}>
          {(row.billing_type === REQUEST_BILLING ? [['request_price', 'Per request']] as [PriceField, string][] : tokenFields).map(([key, label]) => <label key={key} className='grid min-w-0 gap-1 text-[11px] text-ui-text-3'>
            {t(label)} · {row.billing_type === REQUEST_BILLING ? t('USD / request') : 'USD / 1M'}
            <NumberInput aria-label={t(label)} value={row[key]} min={0} step='0.000001' onChange={(value) => update(row._key, key, value)} width='full' />
          </label>)}
        </div>
      </fieldset>)}</div></div>
      {rows.length > 0 && <div className='flex flex-wrap items-center justify-between gap-3'>
        <Select aria-label={t('Prices per page')} value={pageSize} options={[10, 20, 50].map((value) => ({ value, label: t('{{count}} per page', { count: value }) }))} onChange={(value) => { setPageSize(value); setPage(1); }} />
        <div className='min-w-0'><Pagination page={page} pageSize={pageSize} total={rows.length} onChange={setPage} /></div>
      </div>}
    </>}
    {advancedModel && <PricingConfigDialog key={advancedModel} modelName={advancedModel} onClose={() => setAdvancedModel(null)} onSaved={refresh} />}
    {syncOpen && <PricingSync onClose={() => setSyncOpen(false)} onSaved={refresh} />}
    {batchOpen && <PricingBatchDialog open onClose={() => setBatchOpen(false)} onSaved={refresh} modelNames={names} />}
    {deleting && <ConfirmDialog open title={t('Delete model price?')} description={t('Delete the direct price for {{model}}? Existing advanced billing settings are preserved.', { model: deleting.model_name })} confirmText={t('Delete')} cancelText={t('Cancel')} loading={busy} closeOnConfirm={false} onClose={() => { if (!busy) setDeleting(null); }} onConfirm={() => void deleteConfirmed()} />}
    {preview && <Modal open title={t('Synchronize upstream prices')} width={760} onClose={() => { if (!busy) setPreview(null); }} footer={<><Button variant='secondary' disabled={busy} onClick={() => setPreview(null)}>{t('Cancel')}</Button><Button loading={busy} disabled={!selectedSyncModels.length} onClick={() => void applySync()}>{t('Synchronize selected models')}</Button></>}>
      <p className='text-xs leading-relaxed text-ui-text-3'>{t('New prices are selected by default. Review changed prices before selecting them. Source: models.dev')}</p>
      <div className='grid gap-2'>{preview.map((item) => <label key={item.model_name} className='flex items-start gap-3 border-t border-ui-border py-3'>
        <Checkbox aria-label={t('Synchronize {{model}}', { model: item.model_name })} disabled={busy} checked={selectedSyncModels.includes(item.model_name)} onChange={(checked) => setSelectedSyncModels((current) => checked ? [...new Set([...current, item.model_name])] : current.filter((name) => name !== item.model_name))} />
        <div className='min-w-0 space-y-1 break-words text-xs text-ui-text-2'><strong className='break-all text-sm'>{item.model_name}</strong><span className='ml-2 text-ui-text-3'>{item.provider} · {t(item.status === 'new' ? 'New' : item.status === 'description' ? 'Description only' : 'Price changed')}</span>
          <p>{t('Current')}: {priceText(item.local)}</p><p>{t('Upstream')}: {priceText(item.upstream)}</p>
          {item.description && <p>{t(item.description_action === 'preserve' ? 'Preserve local description' : 'Add upstream description')}: {item.description}</p>}
        </div>
      </label>)}</div>
    </Modal>}
  </section>;
}

export default function ModelPricingEditor({ modelSuggestions = [] }: { modelSuggestions?: PricingSuggestion[] }) {
  const identity = useAuthStore((state) => `${state.auth.user?.id}:${state.auth.session?.sid}`);
  return <PricingWorkspace key={identity} identity={identity} modelSuggestions={modelSuggestions} />;
}

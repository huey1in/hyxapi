import { useTranslation } from 'react-i18next';
import { renderNumber, renderQuota, timestamp2string } from '../../helpers';
import { ExpressionBillingLog } from '../../features/pricing/ExpressionBillingLog';
import ToolSurcharges from '../../features/pricing/ToolSurcharges';
import { cacheStatusLabels, getBillingPriceFields } from './log-data';
import type { EnrichedLog } from './log-data';
import { Quota, TypeBadge } from './LogCells';
import { DetailCode, DetailContent, DetailField, DetailFields, DetailSection, DetailText } from './LogDetailLayout';

export default function RequestLogDetail({ row, isAdmin, isRoot }: { row: EnrichedLog; isAdmin: boolean; isRoot: boolean }) {
  const { t, i18n } = useTranslation();
  const other = row._other;
  const source = other.billing_source || other.wallet;
  const conversion = other.request_conversion?.join(' → ') || other.request_convert;
  const prices = getBillingPriceFields(other);
  const hasBillingDetails = !!source || prices.length > 0 || other.billing_mode === 'tiered_expr' || [
    other.group_ratio, other.subscription_id, other.subscription_plan_title, other.subscription_consumed,
    other.subscription_used, other.subscription_total, other.subscription_remain, other.wallet_quota_deducted, other.tool_surcharges,
  ].some((value) => value != null && value !== '');
  const formatUnitPrice = (value: number, unit: string) => `${value.toLocaleString('en-US', { maximumFractionDigits: 10 })} USD / ${t(unit)}`;

  return <DetailContent>
    <div className='min-w-0 space-y-3'>
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0'><h4 className='break-words text-base font-semibold leading-6 text-ui-text'>{row.model_name || t('System operation')}</h4><p className='mt-1 text-xs text-ui-text-3'>{timestamp2string(row.created_at)}</p></div>
        <TypeBadge type={row.type} />
      </div>
      <dl className='grid grid-cols-3 divide-x divide-ui-divider rounded-lg border border-ui-divider bg-ui-bg-subtle/40 py-3'>
        <div className='min-w-0 px-3'><dt className='text-xs text-ui-text-3'>{t('Cost')}</dt><dd className='mt-1 break-all text-base font-semibold tabular-nums text-ui-text'><Quota row={row} /></dd></div>
        <div className='min-w-0 px-3'><dt className='text-xs text-ui-text-3'>{t('Input tokens')}</dt><dd className='mt-1 break-all text-base font-semibold tabular-nums text-ui-text'>{renderNumber(row._inputTokens)}</dd></div>
        <div className='min-w-0 px-3'><dt className='text-xs text-ui-text-3'>{t('Output tokens')}</dt><dd className='mt-1 break-all text-base font-semibold tabular-nums text-ui-text'>{renderNumber(row.completion_tokens)}</dd></div>
      </dl>
    </div>
    <DetailSection title={t('Basic information')}>
      {row._metadataInvalid && <p role='alert' className='text-sm text-ui-text-3'>{t('Some legacy log details could not be read.')}</p>}
      <DetailFields>
        <DetailField label={t('Token name')} value={row.token_name || '—'} />
        <DetailField label={t('Group')} value={row.group || '—'} />
        {row.use_time > 0 && <DetailField label={t('Duration (s)')} value={`${row.use_time}s`} />}
        {other.frt != null && other.frt > 0 && <DetailField label={t('First response time')} value={`${other.frt}ms`} />}
        <DetailField label='IP' value={row.ip || '—'} mono />
        {isAdmin && <DetailField label={t('User')} value={row.username || '—'} />}
        {isAdmin && <DetailField label={t('Channel ID')} value={row.channel || other.channel_id || '—'} />}
        <DetailField label={t('Request ID')} value={row.request_id || '—'} mono wide />
        {isRoot && row.upstream_request_id && <DetailField label={t('Upstream Request ID')} value={row.upstream_request_id} mono wide />}
        {other.request_path && <DetailField label={t('Request path')} value={other.request_path} mono wide />}
        {conversion && <DetailField label={t('Request conversion')} value={conversion} wide />}
        {other.usage_semantic && <DetailField label={t('Usage semantics')} value={other.usage_semantic} />}
        {other.stream_status && <DetailField label={t('Stream status')} value={`${other.stream_status.status || ''}${other.stream_status.end_reason ? ` (${other.stream_status.end_reason})` : ''}`} />}
      </DetailFields>
    </DetailSection>
    {hasBillingDetails && <DetailSection title={t('Billing & usage')}>
      <DetailFields>
        {source && <DetailField label={t('Billing source')} value={source === 'wallet' ? t('Wallet') : source === 'subscription' ? t('Subscription') : source} />}
        {prices.map(({ key, label, unit, value }) => <DetailField key={key} label={t(label)} value={formatUnitPrice(value, unit)} />)}
        {other.billing_mode === 'tiered_expr' && <>
          <DetailField label={t('Billing mode')} value={t('Expression billing')} />
          <DetailField label={t('Matched tier')} value={other.matched_tier || '—'} />
          <DetailField label={t('Billing unit')} value={other.billing_unit || '—'} />
          {other.fixed_price != null && <DetailField label={t('Request price')} value={`${other.fixed_price} USD`} />}
          {other.image_count != null && <DetailField label={t('Billed images')} value={other.image_count} />}
        </>}
        {other.group_ratio != null && <DetailField label={t('Group multiplier')} value={other.group_ratio} />}
        {other.subscription_id != null && <DetailField label={t('Subscription ID')} value={other.subscription_id} />}
        {other.subscription_plan_title && <DetailField label={t('Subscription plan')} value={other.subscription_plan_title} />}
        {other.subscription_consumed != null && <DetailField label={t('Subscription charged')} value={renderQuota(other.subscription_consumed, 4)} />}
        {other.subscription_used != null && <DetailField label={t('Subscription used')} value={renderQuota(other.subscription_used, 4)} />}
        {other.subscription_total != null && <DetailField label={t('Subscription allowance')} value={renderQuota(other.subscription_total, 4)} />}
        {other.subscription_remain != null && <DetailField label={t('Subscription remaining')} value={renderQuota(other.subscription_remain, 4)} />}
        {other.wallet_quota_deducted != null && <DetailField label={t('Wallet charged')} value={renderQuota(other.wallet_quota_deducted, 4)} />}
      </DetailFields>
      {other.tool_surcharges != null && <ToolSurcharges value={other.tool_surcharges} />}
      {other.billing_mode === 'tiered_expr' && <ExpressionBillingLog other={other} modelName={row.model_name} />}
    </DetailSection>}
    {(row.type === 2 || row._cache > 0) && <DetailSection title={t('Request cache')}>
      <DetailFields>
        <DetailField label={t('Cache status')} value={t(cacheStatusLabels[row._cacheStatus])} />
        <DetailField label={t('Cache read tokens')} value={row._cacheReadKnown ? row._cacheHit.toLocaleString(i18n.language) : '—'} />
        <DetailField label={t('Cache write tokens')} value={row._cacheWriteKnown ? row._cacheWrite.toLocaleString(i18n.language) : '—'} />
        {row._cacheHitRate != null && <DetailField label={t('Cache hit rate')} value={new Intl.NumberFormat(i18n.language, { style: 'percent', maximumFractionDigits: 1 }).format(row._cacheHitRate)} />}
        {other.cache_write_tokens_5m != null && <DetailField label={t('Cache write tokens (5m)')} value={other.cache_write_tokens_5m.toLocaleString(i18n.language)} />}
        {other.cache_write_tokens_1h != null && <DetailField label={t('Cache write tokens (1h)')} value={other.cache_write_tokens_1h.toLocaleString(i18n.language)} />}
      </DetailFields>
    </DetailSection>}
    {other.billing_mode === 'tiered_expr' && other.billing_tokens != null && <DetailCode collapsible title={t('Billing token details')} value={JSON.stringify(other.billing_tokens)} />}
    {row.content && <DetailSection title={t('Content')}><DetailText>{row.content}</DetailText></DetailSection>}
    <div className='space-y-2'>
      {isAdmin && Array.isArray(other.admin_info?.request_policy) && <DetailCode collapsible title={t('Request policy decisions')} value={JSON.stringify(other.admin_info.request_policy)} />}
      {other.request_body && <DetailCode collapsible title={t('Request body')} value={other.request_body} />}
      {other.response_body && <DetailCode collapsible title={t('Response body')} value={other.response_body} />}
      {Object.keys(row._rawOther).length > 0 && <DetailCode collapsible title={t('Additional details')} value={JSON.stringify(row._rawOther)} />}
    </div>
  </DetailContent>;
}

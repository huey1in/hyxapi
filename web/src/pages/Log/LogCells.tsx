import { useTranslation } from 'react-i18next';
import { renderNumber, renderQuota } from '../../helpers';
import type { EnrichedLog } from './log-data';
import { cacheStatusLabels } from './log-data';

export function TokenUsage({ row }: { row: EnrichedLog }) {
  const { t, i18n } = useTranslation();
  const showCache = row.type === 2 || row._cache > 0;
  const reported = row._cacheReadKnown || row._cacheWriteKnown;
  return <div className='space-y-0.5 tabular-nums'>
    <Num value={row._inputTokens + row.completion_tokens} />
    <div className='text-sm text-ui-text-3'>{t('Input')} {row._inputTokens.toLocaleString(i18n.language)} · {t('Output')} {row.completion_tokens.toLocaleString(i18n.language)}</div>
    {showCache && <div aria-label={t('Request cache')} className='flex flex-wrap items-baseline justify-start gap-x-2 gap-y-0.5 text-sm text-ui-text-3 md:justify-end'>
      <span className='whitespace-nowrap'>{t(cacheStatusLabels[row._cacheStatus])}{row._cacheHitRate != null && row._cacheHit > 0 && <span className='ml-1'>{new Intl.NumberFormat(i18n.language, { style: 'percent', maximumFractionDigits: 1 }).format(row._cacheHitRate)}</span>}</span>
      {reported && <span>{t('Read')} {row._cacheReadKnown ? row._cacheHit.toLocaleString(i18n.language) : '—'} · {t('Write')} {row._cacheWriteKnown ? row._cacheWrite.toLocaleString(i18n.language) : '—'}</span>}
    </div>}
  </div>;
}

const TYPE_LABELS: Record<number, string> = {
  1: 'Top up', 2: 'Consumption', 3: 'Management', 4: 'System', 5: 'Error', 6: 'Refund', 7: 'Login',
};

const TYPE_COLORS: Record<number, string> = {
  1: '#22c55e', 2: '#000', 3: '#3b82f6', 4: '#8b5cf6', 5: '#ef4444', 6: '#f59e0b',
};

export const TypeBadge = ({ type }: { type: number }) => {
  const { t } = useTranslation();
  const color = TYPE_COLORS[type] || '#999';
  return (
    <span title={t(TYPE_LABELS[type] || 'System')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', maxWidth: '100%', minWidth: 0 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 15, color: 'var(--ui-text)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t(TYPE_LABELS[type] || 'System')}</span>
    </span>
  );
};

const Num = ({ value }: { value: number }) => (
  value > 0
    ? <span style={{ fontVariantNumeric: 'tabular-nums' }}>{renderNumber(value)}</span>
    : <span style={{ color: 'var(--ui-text-3)' }}>—</span>
);

export const Quota = ({ row }: { row: EnrichedLog }) => {
  // 充值 / 退款：绿色正数；从 content 解析充值金额
  if (row.type === 1 || row.type === 6) {
    let amount = row.quota;
    if (!amount && row.content) {
      const m = row.content.match(/[＄$]\s*([\d.]+)/);
      const quotaPerUnit = Number(localStorage.getItem('quota_per_unit'));
      if (m) amount = parseFloat(m[1]) * (Number.isFinite(quotaPerUnit) && quotaPerUnit > 0 ? quotaPerUnit : 500000);
    }
    if (amount > 0) {
      return <span style={{ color: '#22c55e', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>+{renderQuota(amount, 4)}</span>;
    }
    return <span style={{ color: 'var(--ui-text-3)' }}>—</span>;
  }
  if (row.quota > 0) {
    return <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{renderQuota(row.quota, 4)}</span>;
  }
  return <span style={{ color: 'var(--ui-text-3)' }}>—</span>;
};

export const TruncatedField = ({ value, muted = false }: { value: string; muted?: boolean }) => (
  <span
    title={value || undefined}
    style={{
      display: 'block',
      width: '100%',
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      color: muted ? 'var(--ui-text-2)' : undefined,
    }}
  >
    {value || '—'}
  </span>
);

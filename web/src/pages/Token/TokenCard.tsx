import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Copy, Pencil, ExternalLink, Power } from 'lucide-react';
import { IconButton } from '../../components/ui';
import { timestamp2string, renderQuota } from '../../helpers';
import useIsMobile from '../../hooks/useIsMobile';
import { TokenCardFrame } from '../../components/layout/PageSkeletons';
import { manualTokenGroups } from './autoGroups';
import { effectiveTokenStatus } from './token-management';
import type { ManagedToken } from './token-management';

type Props = { row: ManagedToken; preview?: boolean; disabled?: boolean; selected: boolean; onSelect: (checked: boolean) => void; onToggle: () => void; onCopy: () => void; onDelete: () => void; onEdit: () => void; onClient?: () => void };
const PILL: CSSProperties = { display: 'inline-flex', alignItems: 'center', height: 20, paddingInline: 6, borderRadius: 5, fontSize: 11, whiteSpace: 'nowrap' };

const KeyCard = ({ row, preview = false, disabled = false, selected, onSelect, onToggle, onCopy, onDelete, onEdit, onClient }: Props) => {
  const { t } = useTranslation();
  const status = effectiveTokenStatus(row);
  const statusLabel = t(({ 1: 'Enabled', 2: 'Disabled', 3: 'Expired', 4: 'Exhausted' } as Record<number, string>)[status] || 'Unavailable');
  const isMobile = useIsMobile();
  const tokenGroups = manualTokenGroups(row);
  const groupLabel = tokenGroups.length > 0
    ? `${tokenGroups[0]}${tokenGroups.length > 1 ? ` +${tokenGroups.length - 1}` : ''}`
    : Array.isArray(row.auto_groups) && row.auto_groups.length
      ? `Auto · ${row.auto_groups[0]}${row.auto_groups.length > 1 ? ` +${row.auto_groups.length - 1}` : ''}`
      : t('Automatic groups');
  const usageText = row.unlimited_quota
    ? t('Used {{amount}}', { amount: renderQuota(row.used_quota || 0) })
    : `${renderQuota(row.used_quota || 0)} / ${renderQuota((row.used_quota || 0) + (row.remain_quota || 0))}`;

  return (
  <TokenCardFrame data-token-id={row.id}>
    {/* 第一行：名称 + 分组 + 操作 */}
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
        {!preview && <input type='checkbox' aria-label={t('Select API key {{name}}', { name: row.name })} checked={selected} disabled={disabled} onChange={(event) => onSelect(event.target.checked)} />}
        <span title={row.name || t('Untitled')} style={{ fontSize: 14, fontWeight: 500, color: 'var(--ui-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name || t('Untitled')}</span>
        <span style={{ ...PILL, color: 'var(--ui-text-3)', border: '1px solid var(--ui-border)' }}>{groupLabel}</span>
      </div>
      {!preview && <div className={`flex gap-1 shrink-0 ${isMobile ? 'self-end' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
        <IconButton icon={Power} title={t(row.status === 1 ? 'Disable API key' : 'Enable API key')} disabled={disabled} onClick={onToggle} />
        {onClient && <IconButton icon={ExternalLink} title={t('Open chat client')} onClick={onClient} />}
        <IconButton icon={Copy} title={t('Copy')} onClick={onCopy} />
        <IconButton icon={Pencil} title={t('Edit')} onClick={onEdit} />
        <IconButton icon={Trash2} variant='danger' title={t('Delete')} onClick={onDelete} />
      </div>}
    </div>
    {/* 第二行：密钥 + 用量 + 时间 */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--ui-text-2)' }}>
        sk-{row.key?.slice(0, 5)}···{row.key?.slice(-4)}
      </span>
      <span style={{ ...PILL, color: 'var(--ui-text-2)', background: 'var(--ui-bg-subtle)', fontVariantNumeric: 'tabular-nums' }}>
        {usageText}
      </span>
      {!preview && <span style={{ ...PILL, color: status === 1 ? 'var(--ui-text-2)' : 'var(--ui-text-3)', border: '1px solid var(--ui-border)' }}>{statusLabel}</span>}
      {row.unlimited_quota && (
        <span style={{ ...PILL, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>{t('Unlimited')}</span>
      )}
      <span style={{ fontSize: 11, color: 'var(--ui-text-3)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
        {row.accessed_time ? timestamp2string(row.accessed_time) : t('Never used')}
      </span>
    </div>
    {!preview && <div className='flex flex-wrap gap-x-4 gap-y-1 text-xs text-ui-text-3'>
      <span>{t('Expires: {{time}}', { time: row.expired_time === -1 ? t('Never') : timestamp2string(row.expired_time) })}</span>
      {row.model_limits_enabled && <span className='break-all'>{t('Allowed models: {{models}}', { models: row.model_limits || t('None') })}</span>}
      {row.allow_ips && <span className='break-all'>{t('Allowed IPs: {{ips}}', { ips: row.allow_ips })}</span>}
    </div>}
  </TokenCardFrame>
  );
};


export default KeyCard;

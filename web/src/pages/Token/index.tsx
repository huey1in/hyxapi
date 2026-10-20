import { useContext, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { ConfirmDialog, Pagination } from '../../components/ui';
import { ConsolePage, TokenCardsSkeleton } from '../../components/layout/PageSkeletons';
import { StatusContext } from '../../context/Status';
import ClientLaunchDialog from '../../features/chat/ClientLaunchDialog';
import { useChatPresets } from '../../features/chat/use-chat-presets';
import { useTranslation } from 'react-i18next';
import { useTokenManagement } from './use-token-management';
import { effectiveTokenStatus } from './token-management';
import type { ManagedToken } from './token-management';
import TokenListControls from './TokenListControls';
import KeyCard from './TokenCard';
import CodeSamples from './CodeSamples';
import TokenEditModal from './TokenEditModal';

const PREVIEW_TOKENS = [
  { id: 1, name: 'production', key: 'rt_live_8a4f2c91', group: 'production', unlimited_quota: false, used_quota: 486200, remain_quota: 1513800, accessed_time: Math.floor(Date.now() / 1000) - 18 },
  { id: 2, name: 'development', key: 'rt_test_3d71b6e8', group: 'default', unlimited_quota: true, used_quota: 128400, remain_quota: 0, accessed_time: Math.floor(Date.now() / 1000) - 94 },
];

const TokenPage = ({ preview = false }: { preview?: boolean }) => {
  const [statusState] = useContext(StatusContext);
  const { t } = useTranslation();
  const management = useTokenManagement(preview, PREVIEW_TOKENS);
  const { rows, loading } = management;
  const keys = preview ? { 1: 'sk-rt_live_8a4f2c91', 2: 'sk-rt_test_3d71b6e8' } : management.keys;
  const visibleRows = rows.filter((row) => management.status === 'all' || String(effectiveTokenStatus(row)) === management.status);
  const [editing, setEditing] = useState<Partial<ManagedToken> | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; description: string; onOk: () => Promise<void> } | null>(null);
  const [clientToken, setClientToken] = useState<number | null>(null);
  const { presets } = useChatPresets();

  useEffect(() => { setEditing(null); setConfirm(null); setClientToken(null); }, [management.identity]);
  const requestDelete = (tokens: { id: number; name: string }[]) => {
    const targets = tokens.map(({ id, name }) => ({ id, name }));
    setConfirm({ title: t('Delete {{count}} API keys?', { count: targets.length }),
      description: t('This deletes all selected keys, including keys on other pages or hidden by filters. Existing clients using them will stop working.'),
      onOk: async () => { if (await management.deleteTokens(targets)) setConfirm(null); },
    });
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://api.example.com';

  return (
    <ConsolePage>
      {/* API keys */}
      <div className='token-key-list' style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--ui-text)' }}>API keys</span>
          {!preview && <button
            onClick={() => setEditing({ name: '', allow_user_quota_query: true, unlimited_quota: true, remain_quota: 500000, expired_time: -1, group: statusState.status?.default_use_auto_group ? 'auto' : 'default', cross_group_retry: !!statusState.status?.default_use_auto_group })}
            style={{
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
              height: 32, paddingInline: 16, border: '1px solid var(--ui-text)', borderRadius: 24,
              fontSize: 14, color: 'var(--ui-text)', background: 'var(--page-bg)',
              transition: 'background 0.2s ease, color 0.2s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ui-accent)'; e.currentTarget.style.color = 'var(--ui-accent-fg)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--page-bg)'; e.currentTarget.style.color = 'var(--ui-text)'; }}
          >
            <Plus size={14} /> {t('Create API key')}</button>}
        </div>

        {!preview && <TokenListControls key={management.identity} management={management} visibleRows={visibleRows}
          onDeleteSelected={() => requestDelete(Object.values(management.selected))} />}
        {loading ? <TokenCardsSkeleton clientEnabled={presets.length > 0} /> : visibleRows.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ui-text-3)', fontSize: 14 }}>{t('No API keys')}</div>
        ) : visibleRows.map((row) => (
          <KeyCard key={row.id} row={row} preview={preview} disabled={management.busy}
            selected={!!management.selected[row.id]} onSelect={(checked) => management.toggleSelection([row], checked)}
            onToggle={() => management.changeStatus(row)}
            onClient={presets.length && keys[row.id] ? () => setClientToken(row.id) : undefined}
            onCopy={() => management.copyTokens([row], false)} onDelete={() => requestDelete([row])} onEdit={() => setEditing({ ...row })} />
        ))}
      </div>

      {!preview && <Pagination page={management.page} pageSize={management.pageSize} total={management.total} onChange={management.setPage} />}

      {/* 调用示例 */}
      <CodeSamples key={management.identity} origin={origin} rows={rows} keys={keys} />
      {clientToken && <ClientLaunchDialog key={clientToken} tokenKey={keys[clientToken]} onClose={() => setClientToken(null)} />}

      {!preview && <TokenEditModal
        key={management.identity}
        open={!!editing}
        token={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); management.refresh(); }}
        onChanged={() => { void management.refresh(); }}
      />}

      {confirm && (
        <ConfirmDialog open title={confirm.title} description={confirm.description} onConfirm={confirm.onOk}
          loading={management.busy} closeOnConfirm={false} confirmText={t('Delete')} cancelText={t('Cancel')}
          onClose={() => { if (!management.busy) setConfirm(null); }} />
      )}
    </ConsolePage>
  );
};

export default TokenPage;

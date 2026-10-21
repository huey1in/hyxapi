import { useContext, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { ConfirmDialog, Pagination } from '../../components/ui';
import ConsolePageHeader from '../../components/layout/ConsolePageHeader';
import { StatusContext } from '../../context/Status';
import { useTranslation } from 'react-i18next';
import { useTokenManagement } from './use-token-management';
import type { ManagedToken } from './token-management';
import TokenListControls from './TokenListControls';
import TokenTable from './TokenTable';
import TokenEditModal from './TokenEditModal';

const TokenPage = () => {
  const [statusState] = useContext(StatusContext);
  const { t } = useTranslation();
  const management = useTokenManagement();
  const { rows, loading } = management;
  const [editing, setEditing] = useState<Partial<ManagedToken> | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; description: string; onOk: () => Promise<void> } | null>(null);

  useEffect(() => { setEditing(null); setConfirm(null); }, [management.identity]);
  const requestDelete = (token: { id: number; name: string }) => {
    setConfirm({ title: t('Delete API key?'),
      description: `${token.name}\n${t('Clients using this API key will stop working.')}`,
      onOk: async () => { if (await management.deleteToken(token)) setConfirm(null); },
    });
  };

  return (
    <div className='console-content-page token-management-page'>
      <ConsolePageHeader title='API keys' />
      <div className='token-page-toolbar'><button
        disabled={management.busy}
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
        <Plus size={14} /> {t('Create API key')}</button></div>

      <div className='token-key-list' style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <TokenListControls key={management.identity} management={management} />
        <TokenTable rows={rows} loading={loading} disabled={management.busy}
          onToggle={management.changeStatus} onCopy={management.copyToken} onDelete={requestDelete}
          onEdit={async (row) => { const token = await management.loadToken(row); if (token) setEditing(token); }} />
      </div>

      <div className='token-page-pagination'><Pagination page={management.page} pageSize={management.pageSize} total={management.total} onChange={management.setPage} /></div>

      <TokenEditModal
        key={management.identity}
        open={!!editing}
        token={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); management.refresh(); }}
        onChanged={() => { void management.refresh(); }}
      />

      {confirm && (
        <ConfirmDialog open title={confirm.title} description={confirm.description} onConfirm={confirm.onOk}
          loading={management.busy} closeOnConfirm={false} confirmText={t('Delete')} cancelText={t('Cancel')}
          onClose={() => { if (!management.busy) setConfirm(null); }} />
      )}
    </div>
  );
};

export default TokenPage;

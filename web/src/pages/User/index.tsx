import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Pencil, Trash2, ShieldCheck, ShieldOff, ArrowUp, ArrowDown, CreditCard, DollarSign, MoreHorizontal, Copy } from 'lucide-react';
import { API, copy, showSuccess, renderQuota } from '../../helpers';
import { PageShell, Card, Button, IconButton, Input, Table, Pagination, Tag, Modal, ConfirmDialog, Loading, Select } from '../../components/ui';
import type { TableColumn } from '../../components/ui/layout/Table';
import { useAuthStore } from '../../stores/auth-store';
import type { AuthUser } from '../../stores/auth-store';
import type { ApiEnvelope } from '../../types/api';
import { canManageUser, userPageSchema, userErrorMessage } from './user-management';
import type { ManagedUser, UserAction, UserFilters, UserSort } from './user-management';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import UserEditModal from './UserEditModal';
import UserQuotaDialog from './UserQuotaDialog';
import UserBindings from './UserBindings';
import UserSubscriptionsPanel from './UserSubscriptionsPanel';

const emptyFilters: UserFilters = { keyword: '', group: '', role: '', status: '' };
type WindowState = { kind: 'edit' | 'quota' | 'subscriptions' | 'security' | 'bindings' | 'delete'; user: ManagedUser } | { kind: 'create' } | null;

function UsersWorkspace({ actor }: { actor: AuthUser | null }) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const identity = useAuthStore((state) => `${state.auth.user?.id}:${state.auth.session?.sid}`);
  const { busy, run } = useOwnedOperation();
  const [filters, setFilters] = useState(emptyFilters);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState<UserSort>('id');
  const [order, setOrder] = useState('desc');
  const [windowState, setWindowState] = useState<WindowState>(null);
  const [confirm, setConfirm] = useState<{ user: ManagedUser; action: 'passkey' | '2fa' } | null>(null);
  const list = useQuery({
    queryKey: ['managed-users', identity, filters, page, pageSize, sort, order],
    enabled: !!actor && actor.role >= 10,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ ...filters, p: String(page), page_size: String(pageSize), sort_by: sort, sort_order: order });
      const searching = Object.values(filters).some(Boolean);
      const { data } = await API.get<ApiEnvelope<unknown>>(`/api/user/${searching ? 'search' : ''}?${params}`, { signal, skipErrorHandler: true });
      signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to load users'); return userPageSchema.parse(data.data);
    },
    retry: false, gcTime: 0, refetchOnWindowFocus: false,
  });
  const groupList = useQuery({ queryKey: ['managed-user-groups', identity], enabled: !!actor && actor.role >= 10, gcTime: 0, retry: false,
    queryFn: async ({ signal }) => { const { data } = await API.get<ApiEnvelope<string[]>>('/api/group/', { signal, skipErrorHandler: true }); if (!data.success) throw new Error(data.message || 'Unable to load groups'); return data.data ?? []; } });
  const rows = list.data?.items ?? []; const total = list.data?.total ?? 0;
  useEffect(() => { if (list.data && page > Math.max(1, Math.ceil(total / pageSize))) setPage(Math.max(1, Math.ceil(total / pageSize))); }, [list.data, page, pageSize, total]);
  const refresh = () => client.invalidateQueries({ queryKey: ['managed-users', identity] });
  const saved = () => { setWindowState(null); void refresh(); };
  const filter = (key: keyof UserFilters, value: string) => { setPage(1); setFilters((current) => ({ ...current, [key]: value })); };
  const act = (user: ManagedUser, action: UserAction) => run(async (signal) => {
    const { data } = await API.post<ApiEnvelope<unknown>>('/api/user/manage', { id: user.id, action }, { signal, skipErrorHandler: true });
    signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to manage user'); showSuccess(t('User updated')); if (action === 'delete') setWindowState(null); await refresh();
  });
  const date = (value: number) => value ? new Date(value * 1000).toLocaleString(i18n.language) : t('Never');
  const columns: TableColumn<ManagedUser>[] = [
    { key: 'id', title: 'ID', width: 65 },
    { key: 'username', title: t('Username'), render: (user) => <div className='max-w-48 break-all'><span>{user.username}</span>{user.display_name !== user.username && <span className='block text-xs text-ui-text-3'>{user.display_name}</span>}{user.remark && <span className='block text-xs text-ui-text-3' title={user.remark}>{user.remark}</span>}</div> },
    { key: 'email', title: t('Email'), render: (user) => <span className='break-all'>{user.email || '—'}</span> },
    { key: 'group', title: t('User group') },
    { key: 'quota', title: t('Quota'), render: (user) => {
      const totalQuota = user.quota + user.used_quota; const pct = totalQuota > 0 ? Math.min(100, user.used_quota / totalQuota * 100) : 0;
      return <div style={{ minWidth: 120 }}><div className='flex justify-between gap-2 text-xs mb-1'><span>{t('Used {{amount}}', { amount: renderQuota(user.used_quota, 2) })}</span><span className='text-ui-text-3'>{renderQuota(totalQuota, 2)}</span></div><div className='h-1.5 rounded-sm bg-ui-bg-subtle overflow-hidden'><div className='h-full rounded-sm bg-ui-accent' style={{ width: `${pct}%` }} /></div></div>;
    } },
    { key: 'role', title: t('Role'), render: (user) => <Tag color={user.role === 100 ? 'red' : user.role === 10 ? 'blue' : 'grey'}>{t(user.role === 100 ? 'Super administrator' : user.role === 10 ? 'Administrator' : 'Regular user')}</Tag> },
    { key: 'aff_count', title: t('Invites') },
    { key: 'aff_quota', title: t('Earnings'), render: (user) => renderQuota(user.aff_quota, 2) },
    { key: 'last_login_at', title: t('Last login'), render: (user) => <span className='text-xs whitespace-nowrap'>{date(user.last_login_at)}<span className='block text-ui-text-3'>{t('Created: {{time}}', { time: date(user.created_at) })}</span></span> },
    { key: 'status', title: t('Status'), render: (user) => <Tag color={!user.DeletedAt && user.status === 1 ? 'green' : 'grey'}>{t(user.DeletedAt ? 'Deleted' : user.status === 1 ? 'Enabled' : 'Disabled')}</Tag> },
    { key: 'ops', title: t('Actions'), align: 'right', render: (user) => !actor || !canManageUser(actor.role, user) ? null : <div className='flex justify-end gap-1'>
      <IconButton icon={DollarSign} title={t('Adjust quota')} disabled={busy} onClick={() => setWindowState({ kind: 'quota', user })} />
      <IconButton icon={CreditCard} title={t('Manage subscriptions')} disabled={busy} onClick={() => setWindowState({ kind: 'subscriptions', user })} />
      <IconButton icon={Pencil} title={t('Edit')} disabled={busy} onClick={() => setWindowState({ kind: 'edit', user })} />
      {user.role !== 100 && <>
        <IconButton icon={user.status === 1 ? ShieldOff : ShieldCheck} title={t(user.status === 1 ? 'Disable' : 'Enable')} disabled={busy} onClick={() => void act(user, user.status === 1 ? 'disable' : 'enable')} />
        {actor.role === 100 && <IconButton icon={user.role === 10 ? ArrowDown : ArrowUp} title={t(user.role === 10 ? 'Demote' : 'Promote')} disabled={busy} onClick={() => void act(user, user.role === 10 ? 'demote' : 'promote')} />}
      </>}
      <IconButton icon={MoreHorizontal} title={t('Account security')} disabled={busy} onClick={() => setWindowState({ kind: 'security', user })} />
      {user.role !== 100 && <IconButton icon={Trash2} variant='danger' title={t('Delete')} disabled={busy} onClick={() => setWindowState({ kind: 'delete', user })} />}
    </div> },
  ];
  if (!actor || actor.role < 10) return null;
  return <PageShell title={t('User management')} actions={<Button icon={Plus} onClick={() => setWindowState({ kind: 'create' })}>{t('Create user')}</Button>}>
    <Card className='mb-4'>
      <form className='flex flex-wrap gap-2' onSubmit={(event) => { event.preventDefault(); filter('keyword', keyword.trim()); }}>
        <div className='min-w-48 flex-1'><Input aria-label={t('Search users')} placeholder={t('Search username, display name, email or ID')} value={keyword} onChange={setKeyword} /></div>
        <Button type='submit' icon={Search} disabled={list.isFetching}>{t('Search')}</Button><Button type='button' variant='toggle' onClick={() => { setKeyword(''); setFilters(emptyFilters); setPage(1); }}>{t('Reset')}</Button><Button type='button' variant='toggle' disabled={list.isFetching} onClick={() => void refresh()}>{t('Refresh')}</Button>
      </form>
      <div className='mt-3 flex flex-wrap gap-3'>
        <Select aria-label={t('Filter by group')} value={filters.group} onChange={(value) => filter('group', value)} options={[{ value: '', label: t('All groups') }, ...[...new Set([...(groupList.data ?? []), filters.group])].filter(Boolean).map((value) => ({ value, label: value }))]} width={150} size={30} />
        <Select aria-label={t('Filter by role')} value={filters.role} onChange={(value) => filter('role', value)} options={[{ value: '', label: t('All roles') }, { value: '1', label: t('Regular user') }, { value: '10', label: t('Administrator') }, { value: '100', label: t('Super administrator') }]} width={150} size={30} />
        <Select aria-label={t('Filter by status')} value={filters.status} onChange={(value) => filter('status', value)} options={[{ value: '', label: t('All statuses') }, { value: '1', label: t('Enabled') }, { value: '2', label: t('Disabled') }, { value: '-1', label: t('Deleted') }]} width={150} size={30} />
        <Select aria-label={t('Sort users by')} value={sort} onChange={(value) => { setPage(1); setSort(value); }} options={([{ value: 'id', label: 'ID' }, { value: 'username', label: t('Username') }, { value: 'quota', label: t('Quota') }, { value: 'group', label: t('User group') }, { value: 'created_at', label: t('Created time') }, { value: 'last_login_at', label: t('Last login') }] satisfies { value: UserSort; label: string }[])} width={150} size={30} />
        <Select aria-label={t('Sort direction')} value={order} onChange={(value) => { setPage(1); setOrder(value); }} options={[{ value: 'desc', label: t('Descending') }, { value: 'asc', label: t('Ascending') }]} width={140} size={30} />
        <Select aria-label={t('Users per page')} value={pageSize} onChange={(value) => { setPage(1); setPageSize(value); }} options={[20, 50, 100]} width={80} size={30} />
      </div>
      {groupList.isError && <p role='alert' className='mt-2 text-xs text-ui-danger'>{t('Group filters could not be loaded. Refresh this page to retry.')}</p>}
    </Card>
    {list.isError && <p role='alert' className='mb-3 text-sm text-ui-danger'>{t(userErrorMessage(list.error))}</p>}
    {list.isPending ? <Loading /> : <Table columns={columns} rows={rows} minWidth={1360} emptyText={t('No users')} />}
    <div className='mt-4 flex justify-end'><Pagination total={total} pageSize={pageSize} page={page} onChange={setPage} /></div>
    {windowState?.kind === 'create' && <UserEditModal actorRole={actor.role} user={null} onClose={() => setWindowState(null)} onSaved={saved} />}
    {windowState?.kind === 'edit' && <UserEditModal key={windowState.user.id} actorRole={actor.role} user={windowState.user} onClose={() => setWindowState(null)} onSaved={saved} />}
    {windowState?.kind === 'quota' && <UserQuotaDialog user={windowState.user} onClose={() => setWindowState(null)} onSaved={saved} />}
    {windowState?.kind === 'subscriptions' && <UserSubscriptionsPanel user={windowState.user} onClose={() => setWindowState(null)} />}
    {windowState?.kind === 'bindings' && <UserBindings user={windowState.user} onClose={() => setWindowState(null)} onChanged={() => void refresh()} />}
    {windowState?.kind === 'delete' && <DeleteUserModal user={windowState.user} busy={busy} onClose={() => { if (!busy) setWindowState(null); }} onConfirm={() => void act(windowState.user, 'delete')} />}
    {windowState?.kind === 'security' && <Modal open title={t('Account security · {{username}}', { username: windowState.user.username })} onClose={() => { if (!busy && !confirm) setWindowState(null); }} hideFooter width={440}>
      <div className='flex flex-col gap-3 pb-4'><Button variant='toggle' onClick={() => setWindowState({ ...windowState, kind: 'bindings' })}>{t('Manage account bindings')}</Button>
        {windowState.user.role !== 100 && <><Button variant='toggle' onClick={() => setConfirm({ user: windowState.user, action: 'passkey' })}>{t('Reset Passkey')}</Button><Button variant='toggle' onClick={() => setConfirm({ user: windowState.user, action: '2fa' })}>{t('Reset two-factor authentication')}</Button></>}
      </div>
    </Modal>}
    {confirm && <ConfirmDialog open title={t(confirm.action === 'passkey' ? 'Reset Passkey?' : 'Reset two-factor authentication?')} description={t('This removes the security credential for {{username}}. Confirm before continuing.', { username: confirm.user.username })} confirmText={t('Reset')} cancelText={t('Cancel')} loading={busy} closeOnConfirm={false} onClose={() => { if (!busy) setConfirm(null); }} onConfirm={() => run(async (signal) => {
      const { data } = await API.delete<ApiEnvelope<unknown>>(`/api/user/${confirm.user.id}/${confirm.action === 'passkey' ? 'reset_passkey' : '2fa'}`, { signal, skipErrorHandler: true }); signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to reset security credential'); showSuccess(t('Security credential reset')); setConfirm(null); setWindowState(null); await refresh();
    })} />}
  </PageShell>;
}

function DeleteUserModal({ user, busy, onClose, onConfirm }: { user: ManagedUser; busy: boolean; onClose: () => void; onConfirm: () => void }) {
  const { t } = useTranslation(); const [input, setInput] = useState(''); const matched = input.trim() === user.username;
  return <Modal open title={t('Delete user')} width={460} onClose={onClose} footer={<><Button variant='toggle' disabled={busy} onClick={onClose}>{t('Cancel')}</Button><Button loading={busy} disabled={!matched} onClick={onConfirm}>{t('Confirm deletion')}</Button></>}>
    <p className='text-sm text-ui-text-2'>{t('Deleting user #{{id}} prevents sign-in and invalidates their API keys. Type the username to confirm.', { id: user.id })}</p>
    <div className='flex items-center gap-2 rounded-lg bg-ui-bg-subtle px-3 py-2'><code className='flex-1 break-all'>{user.username}</code><IconButton icon={Copy} title={t('Copy username')} onClick={() => void copy(user.username)} /></div>
    <Input aria-label={t('Username confirmation')} value={input} onChange={setInput} onKeyDown={(event) => { if (event.key === 'Enter' && matched && !busy) onConfirm(); }} width='full' />
  </Modal>;
}

export default function UserPage() {
  const actor = useAuthStore((state) => state.auth.user);
  const session = useAuthStore((state) => state.auth.session?.sid);
  return <UsersWorkspace key={`${actor?.id}:${session}`} actor={actor} />;
}

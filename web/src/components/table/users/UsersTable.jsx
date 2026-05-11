/*
 * Users table — token-system rewrite. Cell renderers + small confirm
 * dialogs inlined; replaces the previous CardTable + ColumnDefs setup.
 */
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Edit2, ArrowUp, ArrowDown, Power, MoreHorizontal, Trash2 } from 'lucide-react';
import { renderQuota, renderNumber } from '../../../helpers';
import { showConfirm } from '../../common/ConfirmDialog';
import UserSubscriptionsModal from './modals/UserSubscriptionsModal';

const RoleChip = ({ role, t }) => {
  const map = {
    1: { cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', label: t('普通用户') },
    10: { cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', label: t('管理员') },
    100: { cls: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20', label: t('超级管理员') },
  };
  const cfg = map[role] || {
    cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    label: t('未知身份'),
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] rounded-xl font-medium border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
};

const StatusPill = ({ user, t }) => {
  const isDeleted = user.DeletedAt !== null && user.DeletedAt !== undefined;
  let cls = 'text-ui-text-3 bg-ui-text-3';
  let label = t('未知');
  if (isDeleted) {
    cls = 'text-rose-600 dark:text-rose-400 bg-rose-500';
    label = t('已注销');
  } else if (user.status === 1) {
    cls = 'text-emerald-600 dark:text-emerald-400 bg-emerald-500';
    label = t('已启用');
  } else if (user.status === 2) {
    cls = 'text-rose-600 dark:text-rose-400 bg-rose-500';
    label = t('已禁用');
  }
  const [textCls, dotCls] = cls.split(' bg-');
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${textCls}`}>
      <span className={`w-1.5 h-1.5 rounded-full bg-${dotCls}`} />
      {label}
    </span>
  );
};

const QuotaUsage = ({ user, t }) => {
  const used = parseInt(user.used_quota) || 0;
  const remain = parseInt(user.quota) || 0;
  const total = used + remain;
  const percent = total > 0 ? (remain / total) * 100 : 0;
  return (
    <div
      className='min-w-[120px]'
      title={`${t('已用')} ${renderQuota(used)} · ${t('剩余')} ${renderQuota(remain)} · ${t('总额')} ${renderQuota(total)}`}
    >
      <div className='text-xs tabular-nums text-ui-text-2'>
        {renderQuota(remain)} / {renderQuota(total)}
      </div>
      <div className='mt-1 w-full h-1 bg-ui-bg-subtle rounded-full overflow-hidden'>
        <div
          className='h-full bg-ui-accent transition-all'
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>
    </div>
  );
};

const InviteCell = ({ user, t }) => (
  <div className='flex flex-wrap items-center gap-1 text-[11px] text-ui-text-3'>
    <span className='inline-flex items-center px-1.5 py-0.5 rounded bg-ui-bg-subtle border border-ui-border'>
      {t('邀请')} {renderNumber(user.aff_count || 0)}
    </span>
    <span className='inline-flex items-center px-1.5 py-0.5 rounded bg-ui-bg-subtle border border-ui-border'>
      {t('收益')} {renderQuota(user.aff_history_quota || 0)}
    </span>
    {user.inviter_id ? (
      <span className='inline-flex items-center px-1.5 py-0.5 rounded bg-ui-bg-subtle border border-ui-border'>
        {t('邀请人')} {user.inviter_id}
      </span>
    ) : null}
  </div>
);

const ActionBtn = ({ children, onClick, danger, disabled, title }) => (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onClick?.(e);
    }}
    disabled={disabled}
    title={title}
    className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded transition-colors whitespace-nowrap disabled:opacity-40 ${
      danger
        ? 'text-ui-danger hover:bg-ui-danger-bg disabled:hover:bg-transparent'
        : 'text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle disabled:hover:bg-transparent'
    }`}
  >
    {children}
  </button>
);

const RowMenu = ({ items }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) &&
          btnRef.current && !btnRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleOpen = (e) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + window.scrollY + 4, left: rect.right + window.scrollX });
    }
    setOpen((p) => !p);
  };

  return (
    <div className='relative' ref={btnRef}>
      <button
        onClick={handleOpen}
        className='inline-flex items-center justify-center w-7 h-7 rounded text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-subtle'
      >
        <MoreHorizontal size={14} />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'absolute', top: pos.top, right: 'auto', left: pos.left - 180, zIndex: 9999 }}
          className='min-w-[180px] bg-ui-bg-elevated border border-ui-border rounded-lg shadow-lg overflow-hidden'
        >
          {items.map((it, i) =>
            it.divider ? (
              <div key={`d${i}`} className='border-t border-ui-divider' />
            ) : (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  it.onClick?.();
                }}
                className={`w-full text-left px-3 py-1.5 text-xs whitespace-nowrap hover:bg-ui-bg-subtle transition-colors ${
                  it.danger ? 'text-ui-danger' : 'text-ui-text-2 hover:text-ui-text'
                }`}
              >
                {it.label}
              </button>
            ),
          )}
        </div>,
        document.body,
      )}
    </div>
  );
};

const UsersTable = (usersData) => {
  const {
    users,
    loading,
    setEditingUser,
    setShowEditUser,
    manageUser,
    refresh,
    activePage,
    resetUserPasskey,
    resetUserTwoFA,
    t,
  } = usersData;

  const [subUser, setSubUser] = useState(null);

  const confirmEnableDisable = (user, action) => {
    showConfirm({
      title: action === 'disable' ? t('确定禁用该用户？') : t('确定启用该用户？'),
      content:
        action === 'disable'
          ? t('用户将无法登录与调用接口，可随时重新启用。')
          : t('用户将恢复正常访问权限。'),
      danger: action === 'disable',
      onOk: () => manageUser(user.id, action, user),
    });
  };

  const confirmPromote = (user) => {
    showConfirm({
      title: t('确定提升该用户的权限？'),
      content: t('普通用户 → 管理员，或 管理员 → 超级管理员。请谨慎操作。'),
      onOk: () => manageUser(user.id, 'promote', user),
    });
  };

  const confirmDemote = (user) => {
    showConfirm({
      title: t('确定降低该用户的权限？'),
      content: t('管理员 → 普通用户，或 超级管理员 → 管理员。'),
      onOk: () => manageUser(user.id, 'demote', user),
    });
  };

  const confirmDelete = (user) => {
    showConfirm({
      title: t('确定注销该用户？'),
      content: t('注销后无法恢复，用户的令牌、订阅、调用记录将一并失效。'),
      danger: true,
      okText: t('永久注销'),
      onOk: async () => {
        await manageUser(user.id, 'delete', user);
        await refresh();
        setTimeout(() => {
          if (users.length === 0 && activePage > 1) refresh(activePage - 1);
        }, 100);
      },
    });
  };

  const confirmResetPasskey = (user) => {
    showConfirm({
      title: t('确定重置该用户的 Passkey？'),
      content: t('用户已绑定的所有 Passkey 凭证将被清空，下次需要重新注册。'),
      danger: true,
      onOk: () => resetUserPasskey(user),
    });
  };

  const confirmResetTwoFA = (user) => {
    showConfirm({
      title: t('确定重置该用户的两步验证？'),
      content: t('用户的 TOTP 与备用码将被清空，下次需要重新启用两步验证。'),
      danger: true,
      onOk: () => resetUserTwoFA(user),
    });
  };

  if (loading) {
    return (
      <div className='py-16 text-center text-ui-text-3 text-sm flex items-center justify-center gap-2'>
        <Loader2 size={14} className='animate-spin' />
        {t('加载中...')}
      </div>
    );
  }

  if (!users?.length) {
    return <div className='py-16 text-center text-ui-text-3 text-sm'>{t('搜索无结果')}</div>;
  }

  return (
    <>
      <div className='overflow-x-auto nice-scroll'>
        <table className='w-full text-sm border-collapse'>
          <thead>
            <tr className='border-b border-ui-border bg-ui-bg-subtle/50 text-[11px] uppercase tracking-wider text-ui-text-3'>
              <th className='text-left px-3 py-2.5 font-medium w-16'>ID</th>
              <th className='text-left px-3 py-2.5 font-medium min-w-[160px]'>{t('用户')}</th>
              <th className='text-left px-3 py-2.5 font-medium min-w-[100px]'>{t('状态')}</th>
              <th className='text-left px-3 py-2.5 font-medium min-w-[160px]'>{t('剩余 / 总额度')}</th>
              <th className='text-left px-3 py-2.5 font-medium min-w-[110px]'>{t('角色')}</th>
              <th className='text-left px-3 py-2.5 font-medium min-w-[220px]'>{t('邀请')}</th>
              <th className='text-right px-3 py-2.5 font-medium sticky right-0 bg-ui-bg-subtle/80 backdrop-blur-sm min-w-[280px]'>
                {t('操作')}
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const deleted = u.DeletedAt !== null && u.DeletedAt !== undefined;
              return (
                <tr
                  key={u.id}
                  className={`border-b border-ui-divider last:border-b-0 hover:bg-ui-bg-subtle/40 transition-colors ${
                    deleted ? 'opacity-50' : ''
                  }`}
                >
                  <td className='px-3 py-3 align-middle text-xs text-ui-text-3 tabular-nums'>#{u.id}</td>
                  <td className='px-3 py-3 align-middle min-w-0'>
                    <div className='text-sm font-medium text-ui-text truncate max-w-[200px]'>
                      {u.username}
                    </div>
                    {u.display_name && u.display_name !== u.username && (
                      <div className='text-[11px] text-ui-text-3 truncate max-w-[200px]'>
                        {u.display_name}
                      </div>
                    )}
                    {u.remark && (
                      <div className='mt-0.5 inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400'>
                        <span className='w-1.5 h-1.5 rounded-full bg-emerald-500' />
                        <span className='truncate max-w-[160px]'>{u.remark}</span>
                      </div>
                    )}
                  </td>
                  <td className='px-3 py-3 align-middle'>
                    <StatusPill user={u} t={t} />
                  </td>
                  <td className='px-3 py-3 align-middle'>
                    <QuotaUsage user={u} t={t} />
                  </td>
                  <td className='px-3 py-3 align-middle'>
                    <RoleChip role={u.role} t={t} />
                  </td>
                  <td className='px-3 py-3 align-middle'>
                    <InviteCell user={u} t={t} />
                  </td>
                  <td className='px-3 py-3 align-middle text-right sticky right-0 bg-[var(--page-bg)]'>
                    {deleted ? (
                      <span className='text-[11px] text-ui-text-3'>—</span>
                    ) : (
                      <div className='flex items-center justify-end gap-1'>
                        {u.status === 1 ? (
                          <ActionBtn danger onClick={() => confirmEnableDisable(u, 'disable')}>
                            <Power size={11} />
                            {t('禁用')}
                          </ActionBtn>
                        ) : (
                          <ActionBtn onClick={() => confirmEnableDisable(u, 'enable')}>
                            <Power size={11} />
                            {t('启用')}
                          </ActionBtn>
                        )}
                        <ActionBtn
                          onClick={() => {
                            setEditingUser(u);
                            setShowEditUser(true);
                          }}
                        >
                          <Edit2 size={11} />
                          {t('编辑')}
                        </ActionBtn>
                        <ActionBtn onClick={() => confirmPromote(u)}>
                          <ArrowUp size={11} />
                          {t('提升')}
                        </ActionBtn>
                        <ActionBtn onClick={() => confirmDemote(u)}>
                          <ArrowDown size={11} />
                          {t('降级')}
                        </ActionBtn>
                        <RowMenu
                          items={[
                            { label: t('订阅管理'), onClick: () => setSubUser(u) },
                            { divider: true },
                            { label: t('重置 Passkey'), onClick: () => confirmResetPasskey(u) },
                            { label: t('重置 2FA'), onClick: () => confirmResetTwoFA(u) },
                            { divider: true },
                            { label: t('注销账户'), danger: true, onClick: () => confirmDelete(u) },
                          ]}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <UserSubscriptionsModal
        visible={!!subUser}
        onCancel={() => setSubUser(null)}
        user={subUser}
        t={t}
        onSuccess={() => refresh?.()}
      />
    </>
  );
};

export default UsersTable;

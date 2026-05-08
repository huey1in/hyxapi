/*
 * Quota redemption codes table — token-system rewrite. Cell rendering inline.
 */
import React from 'react';
import { Loader2, Eye, Copy, Edit2, Power, Trash2 } from 'lucide-react';
import { renderQuota, timestamp2string } from '../../../helpers';
import {
  REDEMPTION_STATUS,
  REDEMPTION_STATUS_MAP,
  REDEMPTION_ACTIONS,
} from '../../../constants/redemption.constants';
import { showConfirm } from '../../common/ConfirmDialog';

const isExpired = (record) =>
  record.status === REDEMPTION_STATUS.UNUSED &&
  record.expired_time !== 0 &&
  record.expired_time < Math.floor(Date.now() / 1000);

const StatusPill = ({ status, record, t }) => {
  if (isExpired(record)) {
    return (
      <span className='inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400'>
        <span className='w-1.5 h-1.5 rounded-full bg-amber-500' />
        {t('已过期')}
      </span>
    );
  }
  const cfg = REDEMPTION_STATUS_MAP[status];
  if (!cfg) {
    return <span className='text-xs text-ui-text-3'>{t('未知')}</span>;
  }
  const colorMap = {
    green: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500',
    grey: 'text-ui-text-3 bg-ui-text-3',
    red: 'text-rose-600 dark:text-rose-400 bg-rose-500',
    orange: 'text-amber-600 dark:text-amber-400 bg-amber-500',
  };
  const cls = colorMap[cfg.color] || colorMap.grey;
  const [textCls, dotCls] = cls.split(' bg-');
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${textCls}`}>
      <span className={`w-1.5 h-1.5 rounded-full bg-${dotCls}`} />
      {t(cfg.text)}
    </span>
  );
};

const ActionBtn = ({ children, onClick, disabled, danger, title }) => (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onClick?.(e);
    }}
    disabled={disabled}
    title={title}
    className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded border transition-colors whitespace-nowrap disabled:opacity-40 ${
      danger
        ? 'border-ui-danger/30 text-ui-danger hover:bg-ui-danger-bg disabled:hover:bg-transparent'
        : 'border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle disabled:hover:bg-transparent'
    }`}
  >
    {children}
  </button>
);

const RedemptionsTable = ({
  redemptions,
  loading,
  manageRedemption,
  copyText,
  setEditingRedemption,
  setShowEdit,
  refresh,
  selectedKeys,
  setSelectedKeys,
  activePage,
  t,
}) => {
  const handleDelete = (record) => {
    showConfirm({
      title: t('确定是否要删除此兑换码？'),
      content: t('此修改将不可逆'),
      danger: true,
      onOk: async () => {
        await manageRedemption(record.id, REDEMPTION_ACTIONS.DELETE, record);
        await refresh();
        setTimeout(() => {
          if (redemptions.length === 0 && activePage > 1) refresh(activePage - 1);
        }, 100);
      },
    });
  };

  const isSelected = (record) => selectedKeys?.some((r) => r.key === record.key);
  const allSelected = redemptions.length > 0 && redemptions.every(isSelected);

  const toggleAll = () => {
    if (allSelected) setSelectedKeys([]);
    else setSelectedKeys([...redemptions]);
  };

  const toggleOne = (record) => {
    if (isSelected(record)) {
      setSelectedKeys(selectedKeys.filter((r) => r.key !== record.key));
    } else {
      setSelectedKeys([...(selectedKeys || []), record]);
    }
  };

  if (loading) {
    return (
      <div className='py-16 text-center text-ui-text-3 text-sm flex items-center justify-center gap-2'>
        <Loader2 size={14} className='animate-spin' />
        {t('加载中...')}
      </div>
    );
  }

  if (!redemptions?.length) {
    return <div className='py-16 text-center text-ui-text-3 text-sm'>{t('暂无兑换码')}</div>;
  }

  return (
    <div className='overflow-x-auto nice-scroll'>
      <table className='w-full text-sm border-collapse'>
        <thead>
          <tr className='border-b border-ui-border bg-ui-bg-subtle/50 text-[11px] uppercase tracking-wider text-ui-text-3'>
            <th className='w-10 px-3 py-2.5'>
              <input
                type='checkbox'
                checked={allSelected}
                onChange={toggleAll}
                className='w-3.5 h-3.5 cursor-pointer accent-current'
              />
            </th>
            <th className='text-left px-3 py-2.5 font-medium w-16'>ID</th>
            <th className='text-left px-3 py-2.5 font-medium min-w-[160px]'>{t('名称')}</th>
            <th className='text-left px-3 py-2.5 font-medium min-w-[100px]'>{t('额度')}</th>
            <th className='text-left px-3 py-2.5 font-medium min-w-[100px]'>{t('状态')}</th>
            <th className='text-left px-3 py-2.5 font-medium min-w-[150px]'>{t('创建时间')}</th>
            <th className='text-left px-3 py-2.5 font-medium min-w-[150px]'>{t('过期时间')}</th>
            <th className='text-left px-3 py-2.5 font-medium min-w-[100px]'>{t('兑换人ID')}</th>
            <th className='text-right px-3 py-2.5 font-medium min-w-[260px]'>{t('操作')}</th>
          </tr>
        </thead>
        <tbody>
          {redemptions.map((record) => {
            const expired = isExpired(record);
            const dimmed = record.status !== REDEMPTION_STATUS.UNUSED || expired;
            return (
              <tr
                key={record.key || record.id}
                className={`border-b border-ui-divider last:border-b-0 hover:bg-ui-bg-subtle/40 transition-colors ${
                  dimmed ? 'opacity-60' : ''
                }`}
              >
                <td className='px-3 py-3 align-middle' onClick={(e) => e.stopPropagation()}>
                  <input
                    type='checkbox'
                    checked={isSelected(record)}
                    onChange={() => toggleOne(record)}
                    className='w-3.5 h-3.5 cursor-pointer accent-current'
                  />
                </td>
                <td className='px-3 py-3 align-middle text-xs text-ui-text-3 tabular-nums'>#{record.id}</td>
                <td className='px-3 py-3 align-middle text-sm text-ui-text truncate max-w-[200px]'>
                  {record.name}
                </td>
                <td className='px-3 py-3 align-middle text-xs text-ui-text-2 tabular-nums'>
                  {renderQuota(parseInt(record.quota))}
                </td>
                <td className='px-3 py-3 align-middle'>
                  <StatusPill status={record.status} record={record} t={t} />
                </td>
                <td className='px-3 py-3 align-middle text-xs text-ui-text-3 whitespace-nowrap tabular-nums'>
                  {timestamp2string(record.created_time)}
                </td>
                <td className='px-3 py-3 align-middle text-xs text-ui-text-3 whitespace-nowrap tabular-nums'>
                  {record.expired_time === 0 ? t('永不过期') : timestamp2string(record.expired_time)}
                </td>
                <td className='px-3 py-3 align-middle text-xs text-ui-text-3 tabular-nums'>
                  {record.used_user_id === 0 ? '—' : record.used_user_id}
                </td>
                <td className='px-3 py-3 align-middle text-right'>
                  <div className='flex items-center justify-end gap-1'>
                    <ActionBtn onClick={() => copyText(record.key)} title={record.key}>
                      <Copy size={11} />
                      {t('复制')}
                    </ActionBtn>
                    <ActionBtn
                      onClick={() => {
                        setEditingRedemption(record);
                        setShowEdit(true);
                      }}
                      disabled={record.status !== REDEMPTION_STATUS.UNUSED}
                    >
                      <Edit2 size={11} />
                      {t('编辑')}
                    </ActionBtn>
                    {!expired && record.status === REDEMPTION_STATUS.UNUSED && (
                      <ActionBtn
                        onClick={() =>
                          manageRedemption(record.id, REDEMPTION_ACTIONS.DISABLE, record)
                        }
                      >
                        <Power size={11} />
                        {t('禁用')}
                      </ActionBtn>
                    )}
                    {!expired && record.status === REDEMPTION_STATUS.DISABLED && (
                      <ActionBtn
                        onClick={() =>
                          manageRedemption(record.id, REDEMPTION_ACTIONS.ENABLE, record)
                        }
                      >
                        <Power size={11} />
                        {t('启用')}
                      </ActionBtn>
                    )}
                    <ActionBtn danger onClick={() => handleDelete(record)}>
                      <Trash2 size={11} />
                      {t('删除')}
                    </ActionBtn>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default RedemptionsTable;

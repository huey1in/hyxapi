/*
 * Subscriptions table — token-system rewrite. Cell renderers inlined; no
 * separate ColumnDefs file needed.
 */
import React from 'react';
import { Loader2, Edit2, Power, Info, Ticket } from 'lucide-react';
import { renderQuota } from '../../../helpers';
import { convertUSDToCurrency } from '../../../helpers/render';
import { showConfirm } from '../../common/ConfirmDialog';

const StatusPill = ({ enabled, t }) => (
  <span
    className={`inline-flex items-center gap-1.5 text-xs font-medium ${
      enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
    }`}
  >
    <span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-rose-500'}`} />
    {enabled ? t('启用') : t('禁用')}
  </span>
);

const PaymentChip = ({ children, color }) => {
  const cls = {
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  }[color];
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] rounded border ${cls}`}>
      {children}
    </span>
  );
};

const formatDuration = (plan, t) => {
  if (!plan) return '';
  const u = plan.duration_unit || 'month';
  if (u === 'custom') return `${t('自定义')} ${plan.custom_seconds || 0}s`;
  const map = { year: t('年'), month: t('月'), day: t('日'), hour: t('小时') };
  return `${plan.duration_value || 0}${map[u] || u}`;
};

const formatResetPeriod = (plan, t) => {
  const period = plan?.quota_reset_period || 'never';
  if (period === 'daily') return t('每天');
  if (period === 'weekly') return t('每周');
  if (period === 'monthly') return t('每月');
  if (period === 'custom') {
    const seconds = Number(plan?.quota_reset_custom_seconds || 0);
    if (seconds >= 86400) return `${Math.floor(seconds / 86400)} ${t('天')}`;
    if (seconds >= 3600) return `${Math.floor(seconds / 3600)} ${t('小时')}`;
    if (seconds >= 60) return `${Math.floor(seconds / 60)} ${t('分钟')}`;
    return `${seconds} ${t('秒')}`;
  }
  return t('不重置');
};

const ActionBtn = ({ children, onClick, danger }) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded border transition-colors whitespace-nowrap ${
      danger
        ? 'border-ui-danger/30 text-ui-danger hover:bg-ui-danger-bg'
        : 'border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle'
    }`}
  >
    {children}
  </button>
);

const SubscriptionsTable = ({
  plans,
  loading,
  openEdit,
  openCodes,
  setPlanEnabled,
  t,
}) => {
  if (loading) {
    return (
      <div className='py-16 text-center text-ui-text-3 text-sm flex items-center justify-center gap-2'>
        <Loader2 size={14} className='animate-spin' />
        {t('加载中...')}
      </div>
    );
  }

  if (!plans?.length) {
    return <div className='py-16 text-center text-ui-text-3 text-sm'>{t('暂无订阅套餐')}</div>;
  }

  const handleToggle = (record) => {
    const enabled = record?.plan?.enabled;
    showConfirm({
      title: enabled ? t('确认禁用') : t('确认启用'),
      content: enabled
        ? t('禁用后用户端不再展示，但历史订单不受影响。是否继续？')
        : t('启用后套餐将在用户端展示。是否继续？'),
      danger: enabled,
      onOk: () => setPlanEnabled(record, !enabled),
    });
  };

  return (
    <div className='overflow-x-auto'>
      <table className='w-full text-sm border-collapse'>
        <thead>
          <tr className='border-b border-ui-border bg-ui-bg-subtle/50 text-[11px] uppercase tracking-wider text-ui-text-3'>
            <th className='text-left px-3 py-2.5 font-medium w-16'>ID</th>
            <th className='text-left px-3 py-2.5 font-medium min-w-[180px]'>{t('套餐')}</th>
            <th className='text-left px-3 py-2.5 font-medium min-w-[100px]'>{t('价格')}</th>
            <th className='text-left px-3 py-2.5 font-medium min-w-[90px]'>{t('购买上限')}</th>
            <th className='text-left px-3 py-2.5 font-medium min-w-[80px]'>{t('优先级')}</th>
            <th className='text-left px-3 py-2.5 font-medium min-w-[100px]'>{t('有效期')}</th>
            <th className='text-left px-3 py-2.5 font-medium min-w-[80px]'>{t('重置')}</th>
            <th className='text-left px-3 py-2.5 font-medium min-w-[100px]'>{t('总额度')}</th>
            <th className='text-left px-3 py-2.5 font-medium min-w-[100px]'>{t('升级分组')}</th>
            <th className='text-left px-3 py-2.5 font-medium min-w-[80px]'>{t('状态')}</th>
            <th className='text-right px-3 py-2.5 font-medium sticky right-0 bg-ui-bg-subtle/80 backdrop-blur-sm min-w-[220px]'>
              {t('操作')}
            </th>
          </tr>
        </thead>
        <tbody>
          {plans.map((record) => {
            const plan = record?.plan || {};
            const limit = Number(plan.max_purchase_per_user || 0);
            const total = Number(plan.total_amount || 0);
            const group = plan.upgrade_group || '';
            return (
              <tr key={plan.id} className='border-b border-ui-divider last:border-b-0 hover:bg-ui-bg-subtle/40 transition-colors'>
                <td className='px-3 py-3 align-middle text-xs text-ui-text-3 tabular-nums'>#{plan.id}</td>
                <td className='px-3 py-3 align-middle'>
                  <div className='min-w-0'>
                    <div className='text-sm font-semibold text-ui-text truncate max-w-[200px]'>
                      {plan.title}
                    </div>
                    {plan.subtitle && (
                      <div className='text-[11px] text-ui-text-3 truncate max-w-[200px] mt-0.5'>
                        {plan.subtitle}
                      </div>
                    )}
                  </div>
                </td>
                <td className='px-3 py-3 align-middle'>
                  <span className='text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums'>
                    {convertUSDToCurrency(Number(plan.price_amount || 0), 2)}
                  </span>
                </td>
                <td className='px-3 py-3 align-middle text-xs tabular-nums'>
                  <span className={limit > 0 ? 'text-ui-text-2' : 'text-ui-text-3'}>
                    {limit > 0 ? limit : t('不限')}
                  </span>
                </td>
                <td className='px-3 py-3 align-middle text-xs text-ui-text-3 tabular-nums'>
                  {Number(plan.sort_order || 0)}
                </td>
                <td className='px-3 py-3 align-middle text-xs text-ui-text-2'>
                  {formatDuration(plan, t)}
                </td>
                <td className='px-3 py-3 align-middle text-xs'>
                  <span className={plan.quota_reset_period && plan.quota_reset_period !== 'never' ? 'text-ui-text-2' : 'text-ui-text-3'}>
                    {formatResetPeriod(plan, t)}
                  </span>
                </td>
                <td className='px-3 py-3 align-middle text-xs tabular-nums'>
                  {total > 0 ? (
                    <span className='inline-flex items-center gap-1 text-ui-text-2' title={`${t('原生额度')}：${total}`}>
                      {renderQuota(total)}
                      <Info size={10} className='text-ui-text-3' />
                    </span>
                  ) : (
                    <span className='text-ui-text-3'>{t('不限')}</span>
                  )}
                </td>
                <td className='px-3 py-3 align-middle text-xs'>
                  <span className={group ? 'text-ui-text-2' : 'text-ui-text-3'}>
                    {group || t('不升级')}
                  </span>
                </td>
                <td className='px-3 py-3 align-middle'>
                  <StatusPill enabled={plan.enabled} t={t} />
                </td>
                <td className='px-3 py-3 align-middle text-right sticky right-0 bg-ui-bg-elevated'>
                  <div className='flex items-center justify-end gap-1'>
                    <ActionBtn onClick={() => openCodes?.(record)}>
                      <Ticket size={11} />
                      {t('兑换码')}
                    </ActionBtn>
                    <ActionBtn onClick={() => openEdit(record)}>
                      <Edit2 size={11} />
                      {t('编辑')}
                    </ActionBtn>
                    {plan.enabled ? (
                      <ActionBtn danger onClick={() => handleToggle(record)}>
                        <Power size={11} />
                        {t('禁用')}
                      </ActionBtn>
                    ) : (
                      <ActionBtn onClick={() => handleToggle(record)}>
                        <Power size={11} />
                        {t('启用')}
                      </ActionBtn>
                    )}
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

export default SubscriptionsTable;

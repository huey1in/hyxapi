/*
 * Subscriptions table — token-system rewrite. Cell renderers inlined; no
 * separate ColumnDefs file needed.
 */
import React from 'react';
import { Loader2, Edit2, Power, Info, Ticket, Trash2 } from 'lucide-react';
import { renderQuota } from '../../../helpers';
import { showConfirm } from '../../common/ConfirmDialog';
import TableActionBtn from '../common/TableActionBtn';

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
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] rounded-xl font-medium border ${cls}`}>
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

const parseJsonList = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const formatLimitsSummary = (plan, t) => {
  const groups = parseJsonList(plan?.allowed_groups);
  const models = parseJsonList(plan?.allowed_models);
  const concurrent = Number(plan?.concurrent_limit || 0);
  const rpm = Number(plan?.rpm_limit || 0);
  const parts = [];
  parts.push(groups.length > 0 ? `${t('分组')}：${groups.length}` : `${t('分组')}：${t('不限')}`);
  parts.push(models.length > 0 ? `${t('模型')}：${models.length}` : `${t('模型')}：${t('不限')}`);
  parts.push(concurrent > 0 ? `${t('并发')}：${concurrent}` : `${t('并发')}：${t('不限')}`);
  parts.push(rpm > 0 ? `RPM：${rpm}` : `RPM：${t('不限')}`);
  return parts;
};

const SubscriptionsTable = ({
  plans,
  loading,
  openEdit,
  openCodes,
  setPlanEnabled,
  deletePlan,
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

  const handleDelete = (record) => {
    const plan = record?.plan;
    if (!plan) return;
    showConfirm({
      title: t('确认删除套餐'),
      content: t(
        '将删除套餐「{{title}}」及其所有未使用的兑换码。已激活的用户订阅历史不受影响。该操作不可恢复，是否继续？',
        { title: plan.title || `#${plan.id}` },
      ),
      danger: true,
      onOk: () => deletePlan?.(record),
    });
  };

  return (
    <div className='overflow-x-auto nice-scroll'>
      <table className='w-full text-sm border-collapse' style={{ minWidth: '1100px' }}>
        <thead>
          <tr className='border-b border-ui-border'>
            <th className='text-left px-4 py-3 text-[12px] font-medium text-ui-text-2 whitespace-nowrap w-16'>ID</th>
            <th className='text-left px-4 py-3 text-[12px] font-medium text-ui-text-2 whitespace-nowrap min-w-[180px]'>{t('套餐')}</th>
            <th className='text-left px-4 py-3 text-[12px] font-medium text-ui-text-2 whitespace-nowrap min-w-[80px]'>{t('优先级')}</th>
            <th className='text-left px-4 py-3 text-[12px] font-medium text-ui-text-2 whitespace-nowrap min-w-[100px]'>{t('有效期')}</th>
            <th className='text-left px-4 py-3 text-[12px] font-medium text-ui-text-2 whitespace-nowrap min-w-[80px]'>{t('重置')}</th>
            <th className='text-left px-4 py-3 text-[12px] font-medium text-ui-text-2 whitespace-nowrap min-w-[100px]'>{t('总额度')}</th>
            <th className='text-left px-4 py-3 text-[12px] font-medium text-ui-text-2 whitespace-nowrap min-w-[220px]'>{t('访问限制')}</th>
            <th className='text-left px-4 py-3 text-[12px] font-medium text-ui-text-2 whitespace-nowrap min-w-[80px]'>{t('状态')}</th>
            <th
              className='text-right px-4 py-3 text-[12px] font-medium text-ui-text-2 whitespace-nowrap sticky right-0 min-w-[220px]'
              style={{ backgroundColor: 'var(--page-bg)' }}
            >
              {t('操作')}
            </th>
          </tr>
        </thead>
        <tbody>
          {plans.map((record) => {
            const plan = record?.plan || {};
            const total = Number(plan.total_amount || 0);
            const limitsParts = formatLimitsSummary(plan, t);
            return (
              <tr key={plan.id} className='border-b border-ui-divider last:border-b-0 hover:bg-ui-bg-subtle/50 transition-colors'>
                <td className='px-4 py-3 align-middle text-[13px] text-ui-text-3 tabular-nums'>#{plan.id}</td>
                <td className='px-4 py-3 align-middle'>
                  <div className='min-w-0'>
                    <div className='text-[13px] font-medium text-ui-text truncate max-w-[220px]'>
                      {plan.title}
                    </div>
                    {plan.subtitle && (
                      <div className='text-[11px] text-ui-text-3 truncate max-w-[220px] mt-0.5'>
                        {plan.subtitle}
                      </div>
                    )}
                  </div>
                </td>
                <td className='px-4 py-3 align-middle text-[13px] text-ui-text-3 tabular-nums'>
                  {Number(plan.sort_order || 0)}
                </td>
                <td className='px-4 py-3 align-middle text-[13px] text-ui-text-2 whitespace-nowrap'>
                  {formatDuration(plan, t)}
                </td>
                <td className='px-4 py-3 align-middle text-[13px] whitespace-nowrap'>
                  <span className={plan.quota_reset_period && plan.quota_reset_period !== 'never' ? 'text-ui-text-2' : 'text-ui-text-3'}>
                    {formatResetPeriod(plan, t)}
                  </span>
                </td>
                <td className='px-4 py-3 align-middle text-[13px] tabular-nums whitespace-nowrap'>
                  {total > 0 ? (
                    <span className='inline-flex items-center gap-1 text-ui-text-2' title={`${t('原生额度')}：${total}`}>
                      {renderQuota(total)}
                      <Info size={10} className='text-ui-text-3' />
                    </span>
                  ) : (
                    <span className='text-ui-text-3'>{t('不限')}</span>
                  )}
                </td>
                <td className='px-4 py-3 align-middle text-[12px]'>
                  <div className='flex flex-wrap gap-1.5'>
                    {limitsParts.map((p, idx) => (
                      <span
                        key={idx}
                        className='inline-flex items-center px-1.5 py-0.5 text-[10.5px] rounded-md bg-ui-bg-subtle text-ui-text-2 whitespace-nowrap'
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </td>
                <td className='px-4 py-3 align-middle'>
                  <StatusPill enabled={plan.enabled} t={t} />
                </td>
                <td
                  className='px-4 py-3 align-middle text-right sticky right-0'
                  style={{ backgroundColor: 'var(--page-bg)' }}
                >
                  <div className='flex items-center justify-end gap-1'>
                    <TableActionBtn onClick={() => openCodes?.(record)}>
                      <Ticket size={11} />
                      {t('兑换码')}
                    </TableActionBtn>
                    <TableActionBtn onClick={() => openEdit(record)}>
                      <Edit2 size={11} />
                      {t('编辑')}
                    </TableActionBtn>
                    {plan.enabled ? (
                      <TableActionBtn danger onClick={() => handleToggle(record)}>
                        <Power size={11} />
                        {t('禁用')}
                      </TableActionBtn>
                    ) : (
                      <TableActionBtn onClick={() => handleToggle(record)}>
                        <Power size={11} />
                        {t('启用')}
                      </TableActionBtn>
                    )}
                    <TableActionBtn danger onClick={() => handleDelete(record)}>
                      <Trash2 size={11} />
                      {t('删除')}
                    </TableActionBtn>
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

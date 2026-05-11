/*
 * User subscriptions admin — token-system rewrite (SlideOver + custom table).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, RefreshCw, Trash2, Ban } from 'lucide-react';
import { API, showError, showSuccess } from '../../../../helpers';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import SlideOver from '../../../common/SlideOver';
import { showConfirm } from '../../../common/ConfirmDialog';
import { NativeSelect, FieldRow } from '../../../common/form/Primitives';
import Pagination from '../../../common/table/Pagination';
import { Button } from '../../../ui';

const formatTs = (ts) => (ts ? new Date(ts * 1000).toLocaleString() : '—');

const StatusPill = ({ sub, t }) => {
  const now = Date.now() / 1000;
  const end = sub?.end_time || 0;
  const status = sub?.status || '';
  const expired = end > 0 && end < now;
  const active = status === 'active' && !expired;

  if (active) {
    return (
      <span className='inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400'>
        <span className='w-1.5 h-1.5 rounded-full bg-emerald-500' />
        {t('生效')}
      </span>
    );
  }
  if (status === 'cancelled') {
    return (
      <span className='inline-flex items-center gap-1.5 text-xs font-medium text-ui-text-3'>
        <span className='w-1.5 h-1.5 rounded-full bg-ui-text-3' />
        {t('已作废')}
      </span>
    );
  }
  return (
    <span className='inline-flex items-center gap-1.5 text-xs font-medium text-ui-text-3'>
      <span className='w-1.5 h-1.5 rounded-full bg-ui-text-3' />
      {t('已过期')}
    </span>
  );
};

const PAGE_SIZE = 10;

const UserSubscriptionsModal = ({ visible, onCancel, user, t, onSuccess }) => {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [plansLoading, setPlansLoading] = useState(false);

  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [subs, setSubs] = useState([]);
  const [page, setPage] = useState(1);

  const planTitleMap = useMemo(() => {
    const m = new Map();
    (plans || []).forEach((p) => {
      const id = p?.plan?.id;
      if (id) m.set(id, p?.plan?.title || `#${id}`);
    });
    return m;
  }, [plans]);

  const pagedSubs = useMemo(() => {
    const start = Math.max(0, (page - 1) * PAGE_SIZE);
    return (subs || []).slice(start, start + PAGE_SIZE);
  }, [subs, page]);

  const loadPlans = async () => {
    setPlansLoading(true);
    try {
      const { data } = await API.get('/api/subscription/admin/plans');
      if (data?.success) setPlans(data.data || []);
      else showError(data?.message || t('加载失败'));
    } catch (e) {
      showError(e.message);
    } finally {
      setPlansLoading(false);
    }
  };

  const loadUserSubscriptions = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data } = await API.get(
        `/api/subscription/admin/users/${user.id}/subscriptions`,
      );
      if (data?.success) {
        setSubs(data.data || []);
        setPage(1);
      } else {
        showError(data?.message || t('加载失败'));
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    setSelectedPlanId('');
    setPage(1);
    loadPlans();
    loadUserSubscriptions();
  }, [visible, user?.id]); // eslint-disable-line

  const createSubscription = async () => {
    if (!user?.id) return showError(t('用户信息缺失'));
    if (!selectedPlanId) return showError(t('请选择订阅套餐'));
    setCreating(true);
    try {
      const { data } = await API.post(
        `/api/subscription/admin/users/${user.id}/subscriptions`,
        { plan_id: Number(selectedPlanId) },
      );
      if (data?.success) {
        showSuccess(data?.data?.message || t('新增成功'));
        setSelectedPlanId('');
        await loadUserSubscriptions();
        onSuccess?.();
      } else {
        showError(data?.message || t('新增失败'));
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const invalidateSubscription = (subId) => {
    showConfirm({
      title: t('确认作废'),
      content: t('作废后该订阅将立即失效，历史记录不受影响。是否继续？'),
      onOk: async () => {
        try {
          const { data } = await API.post(
            `/api/subscription/admin/user_subscriptions/${subId}/invalidate`,
          );
          if (data?.success) {
            showSuccess(data?.data?.message || t('已作废'));
            await loadUserSubscriptions();
            onSuccess?.();
          } else {
            showError(data?.message || t('操作失败'));
          }
        } catch (e) {
          showError(e.message);
        }
      },
    });
  };

  const deleteSubscription = (subId) => {
    showConfirm({
      title: t('确认删除'),
      content: t('删除会彻底移除该订阅记录（含权益明细）。是否继续？'),
      danger: true,
      okText: t('删除'),
      onOk: async () => {
        try {
          const { data } = await API.delete(
            `/api/subscription/admin/user_subscriptions/${subId}`,
          );
          if (data?.success) {
            showSuccess(data?.data?.message || t('已删除'));
            await loadUserSubscriptions();
            onSuccess?.();
          } else {
            showError(data?.message || t('删除失败'));
          }
        } catch (e) {
          showError(e.message);
        }
      },
    });
  };

  return (
    <SlideOver
      open={!!visible}
      onClose={onCancel}
      placement='right'
      width={isMobile ? window.innerWidth : 920}
      title={
        <>
          <span className='inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400'>
            {t('管理')}
          </span>
          <span className='text-base font-semibold text-ui-text truncate'>
            {t('用户订阅管理')}
          </span>
          <span className='text-xs text-ui-text-3 truncate'>
            {user?.username || '-'} <span className='text-ui-text-3'>·</span> ID: {user?.id || '-'}
          </span>
        </>
      }
      bodyClass='p-5 space-y-4'
    >
      {/* Add subscription */}
      <div className='border border-ui-border rounded-lg p-4 bg-ui-bg-subtle'>
        <div className='text-sm font-semibold text-ui-text mb-3'>{t('新增订阅')}</div>
        <div className='flex flex-col sm:flex-row gap-2'>
          <div className='flex-1'>
            <NativeSelect
              value={selectedPlanId}
              onChange={setSelectedPlanId}
              disabled={plansLoading}
              options={[
                { value: '', label: t('请选择订阅套餐') },
                ...plans.map((p) => ({
                  value: String(p?.plan?.id),
                  label: `${p?.plan?.title || ''}${p?.plan?.enabled ? '' : ` · ${t('已禁用')}`}`,
                })),
              ]}
            />
          </div>
          <Button
            icon={creating ? Loader2 : Plus}
            onClick={createSubscription}
            disabled={creating || !selectedPlanId}
          >
            {t('新增订阅')}
          </Button>
        </div>
      </div>

      {/* List header + refresh */}
      <div className='flex items-center justify-between'>
        <div className='text-xs text-ui-text-3'>
          {t('共 {{n}} 条订阅记录', { n: subs.length })}
        </div>
        <Button
          size='sm'
          variant='secondary'
          icon={RefreshCw}
          onClick={loadUserSubscriptions}
          disabled={loading}
        >
          {t('刷新')}
        </Button>
      </div>

      {/* List */}
      <div className='border border-ui-border rounded-lg overflow-hidden'>
        {loading ? (
          <div className='py-12 text-center text-ui-text-3 text-sm flex items-center justify-center gap-2'>
            <Loader2 size={14} className='animate-spin' />
            {t('加载中...')}
          </div>
        ) : subs.length === 0 ? (
          <div className='py-12 text-center text-ui-text-3 text-sm'>
            {t('暂无订阅记录')}
          </div>
        ) : (
          <div className='overflow-x-auto nice-scroll'>
            <table className='w-full text-sm border-collapse'>
              <thead>
                <tr className='border-b border-ui-border bg-ui-bg-subtle/50 text-[11px] uppercase tracking-wider text-ui-text-3'>
                  <th className='text-left px-3 py-2.5 font-medium w-16'>ID</th>
                  <th className='text-left px-3 py-2.5 font-medium min-w-[180px]'>{t('套餐')}</th>
                  <th className='text-left px-3 py-2.5 font-medium min-w-[100px]'>{t('状态')}</th>
                  <th className='text-left px-3 py-2.5 font-medium min-w-[200px]'>{t('有效期')}</th>
                  <th className='text-left px-3 py-2.5 font-medium min-w-[120px]'>{t('已用 / 总额')}</th>
                  <th className='text-right px-3 py-2.5 font-medium min-w-[140px]'>{t('操作')}</th>
                </tr>
              </thead>
              <tbody>
                {pagedSubs.map((row) => {
                  const sub = row?.subscription || {};
                  const planTitle = planTitleMap.get(sub.plan_id) || (sub.plan_id ? `#${sub.plan_id}` : '—');
                  const total = Number(sub.amount_total || 0);
                  const used = Number(sub.amount_used || 0);
                  const now = Date.now() / 1000;
                  const expired = (sub.end_time || 0) > 0 && (sub.end_time || 0) < now;
                  const active = sub.status === 'active' && !expired;
                  const cancelled = sub.status === 'cancelled';
                  return (
                    <tr key={sub.id} className='border-b border-ui-divider last:border-b-0 hover:bg-ui-bg-subtle/40'>
                      <td className='px-3 py-3 align-middle text-xs text-ui-text-3 tabular-nums'>#{sub.id}</td>
                      <td className='px-3 py-3 align-middle min-w-0'>
                        <div className='text-sm font-medium text-ui-text truncate max-w-[200px]'>
                          {planTitle}
                        </div>
                        <div className='text-[11px] text-ui-text-3 mt-0.5'>
                          {t('来源')}: {sub.source || '-'}
                        </div>
                      </td>
                      <td className='px-3 py-3 align-middle'>
                        <StatusPill sub={sub} t={t} />
                      </td>
                      <td className='px-3 py-3 align-middle text-[11px] text-ui-text-3 tabular-nums whitespace-nowrap'>
                        <div>
                          <span className='text-ui-text-3'>{t('开始')}</span> {formatTs(sub.start_time)}
                        </div>
                        <div>
                          <span className='text-ui-text-3'>{t('结束')}</span> {formatTs(sub.end_time)}
                        </div>
                      </td>
                      <td className='px-3 py-3 align-middle text-xs tabular-nums'>
                        {total > 0 ? (
                          <span className='text-ui-text-2'>
                            {used} / {total}
                          </span>
                        ) : (
                          <span className='text-ui-text-3'>{t('不限')}</span>
                        )}
                      </td>
                      <td className='px-3 py-3 align-middle text-right'>
                        <div className='flex items-center justify-end gap-1'>
                          <Button
                            size='sm'
                            icon={Ban}
                            onClick={() => invalidateSubscription(sub.id)}
                            disabled={!active || cancelled}
                            className='bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                          >
                            {t('作废')}
                          </Button>
                          <Button
                            size='sm'
                            variant='danger'
                            icon={Trash2}
                            onClick={() => deleteSubscription(sub.id)}
                          >
                            {t('删除')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {subs.length > PAGE_SIZE && (
          <div className='border-t border-ui-divider'>
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={subs.length}
              onChange={setPage}
            />
          </div>
        )}
      </div>
    </SlideOver>
  );
};

export default UserSubscriptionsModal;

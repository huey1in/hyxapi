/*
 * RedemptionsPage — 与 web-backup 同构。
 * Tab: 额度兑换码 / 订阅兑换码
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, RefreshCw, Search, X, Trash2 } from 'lucide-react';
import { API, copy, showError, showSuccess } from '../../../helpers';
import { useRedemptionsData } from '../../../hooks/redemptions/useRedemptionsData';
import {
  Button, Card, Pagination, Tabs, Input, IconButton, Select,
} from '../../ui';
import { showConfirm } from '../confirm';
import RedemptionsTable from './RedemptionsTable';
import EditRedemptionModal from './modals/EditRedemptionModal';
import SubscriptionCodeBatchModal from './modals/SubscriptionCodeBatchModal';
import { cn } from '../../ui/tokens';

const RedemptionsPage = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState('quota');
  const data = useRedemptionsData();

  const [plans, setPlans] = useState([]);
  const [planFilter, setPlanFilter] = useState('all');
  const [subCodes, setSubCodes] = useState([]);
  const [subLoading, setSubLoading] = useState(false);
  const [subKeyword, setSubKeyword] = useState('');
  const [showSubGenerator, setShowSubGenerator] = useState(false);

  const loadSubscriptionPlans = async () => {
    try {
      const { data } = await API.get('/api/subscription/admin/plans');
      if (data?.success) setPlans(data.data || []);
      else showError(data?.message || t('加载失败'));
    } catch (e) { showError(e.message); }
  };

  const loadSubscriptionCodes = async () => {
    setSubLoading(true);
    try {
      if (planFilter === 'all') {
        const results = await Promise.all(
          plans.map(async (p) => {
            try {
              const { data } = await API.get(`/api/subscription/admin/plans/${p.plan.id}/codes`);
              if (data?.success) return (data.data || []).map((c) => ({ ...c, _plan_title: p.plan.title }));
            } catch {}
            return [];
          }),
        );
        setSubCodes(results.flat().sort((a, b) => b.id - a.id));
      } else {
        const { data } = await API.get(`/api/subscription/admin/plans/${planFilter}/codes`);
        if (data?.success) {
          const planTitle = plans.find((p) => p.plan.id === Number(planFilter))?.plan?.title || '';
          setSubCodes((data.data || []).map((c) => ({ ...c, _plan_title: planTitle })));
        } else showError(data?.message || t('加载失败'));
      }
    } catch (e) { showError(e.message); }
    finally { setSubLoading(false); }
  };

  useEffect(() => { if (tab === 'subscription') loadSubscriptionPlans(); }, [tab]);
  useEffect(() => { if (tab === 'subscription' && plans.length > 0) loadSubscriptionCodes(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab, plans, planFilter]);

  const filteredSubCodes = useMemo(() => {
    const q = subKeyword.trim().toLowerCase();
    if (!q) return subCodes;
    return subCodes.filter((c) =>
      (c.key || '').toLowerCase().includes(q) ||
      (c.name || '').toLowerCase().includes(q) ||
      (c._plan_title || '').toLowerCase().includes(q));
  }, [subCodes, subKeyword]);

  const deleteSubscriptionCode = (id) => {
    showConfirm({
      title: t('确认删除该兑换码？'),
      content: t('删除后用户将无法再使用该兑换码。已使用的兑换码可放心删除，不影响已激活的订阅。'),
      danger: true,
      onOk: async () => {
        try {
          const { data } = await API.delete(`/api/subscription/admin/codes/${id}`);
          if (data?.success) { showSuccess(t('已删除')); await loadSubscriptionCodes(); }
          else showError(data?.message || t('删除失败'));
        } catch (e) { showError(e.message); }
      },
    });
  };

  const copyAllUnusedSub = async () => {
    const unused = filteredSubCodes.filter((c) => c.status === 1).map((c) => c.key);
    if (!unused.length) return showError(t('没有未使用的兑换码'));
    if (await copy(unused.join('\n'))) showSuccess(t('已复制 {{n}} 条', { n: unused.length }));
    else showError(t('复制失败'));
  };

  return (
    <div className='px-4 pt-8 pb-6 md:px-6 md:pt-10 md:pb-8 overflow-x-hidden' style={{ backgroundColor: 'var(--page-bg)' }}>
      <div className='max-w-[1400px] mx-auto'>
        <div className='flex items-center justify-between gap-3 mb-5'>
          <h1 className='text-2xl font-semibold text-ui-text' style={{ letterSpacing: '-0.02em' }}>{t('兑换码管理')}</h1>
          <Tabs value={tab} onChange={setTab}
            items={[{ value: 'quota', label: t('额度兑换码') }, { value: 'subscription', label: t('订阅兑换码') }]}
          />
        </div>

        {tab === 'quota' ? <QuotaMode data={data} t={t} /> : (
          <SubscriptionMode
            t={t} plans={plans} planFilter={planFilter} setPlanFilter={setPlanFilter}
            subKeyword={subKeyword} setSubKeyword={setSubKeyword}
            subLoading={subLoading} filteredSubCodes={filteredSubCodes}
            loadSubscriptionCodes={loadSubscriptionCodes}
            copyAllUnusedSub={copyAllUnusedSub}
            deleteSubscriptionCode={deleteSubscriptionCode}
            openGenerator={() => setShowSubGenerator(true)}
          />
        )}
      </div>

      <EditRedemptionModal
        refresh={data.refresh}
        editingRedemption={data.editingRedemption}
        visiable={data.showEdit}
        handleClose={data.closeEdit}
      />
      <SubscriptionCodeBatchModal
        visible={showSubGenerator}
        plans={plans}
        defaultPlanId={planFilter !== 'all' ? Number(planFilter) : null}
        onClose={() => setShowSubGenerator(false)}
        onCreated={() => loadSubscriptionCodes()}
        t={t}
      />
    </div>
  );
};

const QuotaMode = ({ data, t }) => {
  const [keyword, setKeyword] = useState('');
  const { setFormApi, searchRedemptions } = data;
  useEffect(() => {
    setFormApi({
      getValues: () => ({ searchKeyword: keyword }),
      reset: () => setKeyword(''),
      setValue: (f, v) => f === 'searchKeyword' && setKeyword(v || ''),
    });
  }, [keyword, setFormApi]);

  const search = () => searchRedemptions();
  const reset  = () => { setKeyword(''); setTimeout(() => searchRedemptions(), 0); };

  return (
    <>
      <Card>
        <div className='flex flex-col md:flex-row md:items-center justify-between gap-2'>
          <div className='flex flex-wrap items-center gap-1.5'>
            <Button icon={Plus} onClick={() => { data.setEditingRedemption({ id: undefined }); data.setShowEdit(true); }}>{t('添加兑换码')}</Button>
            <Button variant='toggle' onClick={data.batchCopyRedemptions} disabled={!data.selectedKeys.length}>{t('复制所选')}</Button>
            <Button variant='toggle' icon={Trash2} onClick={data.batchDeleteRedemptions}>{t('清除失效')}</Button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); search(); }} className='flex items-center gap-1.5'>
            <Input
              value={keyword} onChange={setKeyword}
              placeholder={t('关键字（ID 或名称）')}
              prefix={<Search size={12} />}
              suffix={keyword ? <IconButton size='xs' icon={X} onClick={() => setKeyword('')} /> : null}
              width={260}
            />
            <Button type='submit' variant='toggle' disabled={data.searching}>{data.searching ? t('查询中...') : t('查询')}</Button>
            <Button type='button' variant='toggle' onClick={reset}>{t('重置')}</Button>
          </form>
        </div>
      </Card>
      <div className='h-3' />
      <Card noPadding>
        <RedemptionsTable {...data} />
        {data.tokenCount > 0 && (
          <div className='border-t border-ui-divider'>
            <Pagination
              page={data.activePage} pageSize={data.pageSize} total={data.tokenCount}
              pageSizeOpts={[10, 20, 50, 100]}
              onChange={data.handlePageChange} onPageSizeChange={data.handlePageSizeChange}
            />
          </div>
        )}
      </Card>
    </>
  );
};

const SubscriptionStatusPill = ({ status, t }) => {
  const unused = status === 1;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-medium', unused ? 'text-emerald-600 dark:text-emerald-400' : 'text-ui-text-3')}>
      <span className={cn('w-1.5 h-1.5 rounded-full', unused ? 'bg-emerald-500' : 'bg-ui-text-3')} />
      {unused ? t('未使用') : t('已使用')}
    </span>
  );
};

const SubscriptionMode = ({
  t, plans, planFilter, setPlanFilter, subKeyword, setSubKeyword,
  subLoading, filteredSubCodes, loadSubscriptionCodes, copyAllUnusedSub, deleteSubscriptionCode, openGenerator,
}) => (
  <>
    <Card>
      <div className='flex flex-col md:flex-row md:items-center justify-between gap-2'>
        <div className='flex flex-wrap items-center gap-1.5'>
          <Button icon={Plus} onClick={openGenerator} disabled={plans.length === 0}>{t('生成订阅兑换码')}</Button>
          <Button variant='toggle' icon={RefreshCw} onClick={loadSubscriptionCodes} disabled={subLoading}>{t('刷新')}</Button>
          <Button variant='toggle' onClick={copyAllUnusedSub} disabled={!filteredSubCodes.some((c) => c.status === 1)}>{t('复制未使用')}</Button>
        </div>
        <div className='flex items-center gap-1.5'>
          <Select
            value={planFilter}
            onChange={setPlanFilter}
            options={[{ value: 'all', label: t('全部套餐') }, ...plans.map((p) => ({ value: String(p.plan.id), label: p.plan.title }))]}
            width={180}
          />
          <Input
            value={subKeyword} onChange={setSubKeyword}
            placeholder={t('搜索 key / 名称 / 套餐')}
            prefix={<Search size={12} />}
            suffix={subKeyword ? <IconButton size='xs' icon={X} onClick={() => setSubKeyword('')} /> : null}
            width={220}
          />
        </div>
      </div>
    </Card>
    <div className='h-3' />
    <Card noPadding>
      {subLoading ? (
        <div className='py-16 text-center text-ui-text-3 text-sm flex items-center justify-center gap-2'>
          <RefreshCw size={14} className='animate-spin' />{t('加载中...')}
        </div>
      ) : filteredSubCodes.length === 0 ? (
        <div className='py-16 text-center text-ui-text-3 text-sm'>{t('暂无兑换码')}</div>
      ) : (
        <div className='overflow-x-auto'>
          <table className='w-full text-sm border-collapse'>
            <thead>
              <tr className='border-b border-ui-border bg-ui-bg-subtle/50 text-[11px] uppercase tracking-wider text-ui-text-3'>
                <th className='text-left px-3 py-2.5 font-medium w-16'>ID</th>
                <th className='text-left px-3 py-2.5 font-medium min-w-[160px]'>{t('套餐')}</th>
                <th className='text-left px-3 py-2.5 font-medium min-w-[280px]'>{t('兑换码')}</th>
                <th className='text-left px-3 py-2.5 font-medium min-w-[140px]'>{t('备注')}</th>
                <th className='text-left px-3 py-2.5 font-medium min-w-[100px]'>{t('状态')}</th>
                <th className='text-right px-3 py-2.5 font-medium min-w-[120px]'>{t('操作')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubCodes.map((c) => (
                <tr key={c.id} className='border-b border-ui-divider last:border-b-0 hover:bg-ui-bg-subtle/40'>
                  <td className='px-3 py-3 align-middle text-xs text-ui-text-3 tabular-nums'>#{c.id}</td>
                  <td className='px-3 py-3 align-middle text-sm text-ui-text-2 truncate max-w-[180px]'>{c._plan_title || '-'}</td>
                  <td className='px-3 py-3 align-middle'><code className='font-mono text-xs text-ui-text break-all select-all'>{c.key}</code></td>
                  <td className='px-3 py-3 align-middle text-xs text-ui-text-2 truncate max-w-[180px]'>{c.name || '-'}</td>
                  <td className='px-3 py-3 align-middle'><SubscriptionStatusPill status={c.status} t={t} /></td>
                  <td className='px-3 py-3 align-middle text-right'>
                    <div className='flex items-center justify-end gap-1'>
                      <Button onClick={async () => {
                        if (await copy(c.key)) showSuccess(t('已复制'));
                        else showError(t('复制失败'));
                      }}>{t('复制')}</Button>
                      <Button variant='toggle' icon={Trash2} onClick={() => deleteSubscriptionCode(c.id)}>{t('删除')}</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  </>
);

export default RedemptionsPage;

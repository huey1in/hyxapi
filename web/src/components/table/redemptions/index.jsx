/*
 * Redemption code admin page — token-system rewrite.
 * Manages two kinds of codes via a tab switcher:
 *   - 额度兑换码 (existing /api/redemption/* — backed by useRedemptionsData)
 *   - 订阅兑换码 (/api/subscription/admin/plans/:id/codes — added recently)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, RefreshCw, Search, X, Trash2 } from 'lucide-react';
import { API, copy, showError, showSuccess, showInfo } from '../../../helpers';
import { useRedemptionsData } from '../../../hooks/redemptions/useRedemptionsData';
import Pagination from '../../common/table/Pagination';
import { showConfirm } from '../../common/ConfirmDialog';
import RedemptionsTable from './RedemptionsTable';
import EditRedemptionModal from './modals/EditRedemptionModal';
import SubscriptionCodeBatchModal from './modals/SubscriptionCodeBatchModal';

const inputCls =
  'w-full pl-8 pr-3 py-1.5 text-xs bg-transparent border border-ui-border rounded-md text-ui-text placeholder:text-ui-text-3 outline-none focus:border-ui-text-3 transition-colors';

const Tabs = ({ active, onChange, items }) => (
  <div className='flex items-center gap-1'>
    {items.map((it) => (
      <button
        key={it.value}
        onClick={() => onChange(it.value)}
        className={`px-3 py-1.5 text-xs rounded-xl transition-colors whitespace-nowrap ${
          active === it.value
            ? 'bg-ui-bg-subtle text-ui-text font-semibold border border-ui-text-3'
            : 'border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle'
        }`}
      >
        {it.label}
      </button>
    ))}
  </div>
);

const RedemptionsPage = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState('quota'); // 'quota' | 'subscription'

  // ── quota mode (existing hook) ─────────────────────────
  const data = useRedemptionsData();

  // ── subscription mode local state ──────────────────────
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
    } catch (e) {
      showError(e.message);
    }
  };

  const loadSubscriptionCodes = async () => {
    setSubLoading(true);
    try {
      if (planFilter === 'all') {
        // Aggregate across all plans
        const results = await Promise.all(
          plans.map(async (p) => {
            try {
              const { data } = await API.get(
                `/api/subscription/admin/plans/${p.plan.id}/codes`,
              );
              if (data?.success) {
                return (data.data || []).map((c) => ({
                  ...c,
                  _plan_title: p.plan.title,
                }));
              }
            } catch {}
            return [];
          }),
        );
        const merged = results.flat().sort((a, b) => b.id - a.id);
        setSubCodes(merged);
      } else {
        const { data } = await API.get(
          `/api/subscription/admin/plans/${planFilter}/codes`,
        );
        if (data?.success) {
          const planTitle =
            plans.find((p) => p.plan.id === Number(planFilter))?.plan?.title || '';
          setSubCodes(
            (data.data || []).map((c) => ({ ...c, _plan_title: planTitle })),
          );
        } else {
          showError(data?.message || t('加载失败'));
        }
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setSubLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'subscription') {
      loadSubscriptionPlans();
    }
  }, [tab]);

  useEffect(() => {
    if (tab === 'subscription' && plans.length > 0) {
      loadSubscriptionCodes();
    }
  }, [tab, plans, planFilter]); // eslint-disable-line

  const filteredSubCodes = useMemo(() => {
    const q = subKeyword.trim().toLowerCase();
    if (!q) return subCodes;
    return subCodes.filter(
      (c) =>
        (c.key || '').toLowerCase().includes(q) ||
        (c.name || '').toLowerCase().includes(q) ||
        (c._plan_title || '').toLowerCase().includes(q),
    );
  }, [subCodes, subKeyword]);

  const deleteSubscriptionCode = async (id) => {
    showConfirm({
      title: t('确认删除该兑换码？'),
      content: t('删除后用户将无法再使用该兑换码。已使用的兑换码可放心删除，不影响已激活的订阅。'),
      danger: true,
      onOk: async () => {
        try {
          const { data } = await API.delete(`/api/subscription/admin/codes/${id}`);
          if (data?.success) {
            showSuccess(t('已删除'));
            await loadSubscriptionCodes();
          } else {
            showError(data?.message || t('删除失败'));
          }
        } catch (e) {
          showError(e.message);
        }
      },
    });
  };

  const copyAllUnusedSub = async () => {
    const unused = filteredSubCodes.filter((c) => c.status === 1).map((c) => c.key);
    if (!unused.length) return showError(t('没有未使用的兑换码'));
    if (await copy(unused.join('\n'))) {
      showSuccess(t('已复制 {{n}} 条', { n: unused.length }));
    } else {
      showError(t('复制失败'));
    }
  };

  return (
    <div className='px-4 pt-8 pb-6 md:px-6 md:pt-10 md:pb-8'>
      <div className='max-w-[1400px] mx-auto'>
        {/* Header */}
        <div className='flex items-center justify-between gap-3 mb-5'>
          <h1
            className='text-2xl md:text-3xl font-medium text-ui-text'
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}
          >
            {t('兑换码管理')}
          </h1>
          <Tabs
            active={tab}
            onChange={setTab}
            items={[
              { value: 'quota', label: t('额度兑换码') },
              { value: 'subscription', label: t('订阅兑换码') },
            ]}
          />
        </div>

        {tab === 'quota' ? (
          <QuotaMode data={data} t={t} />
        ) : (
          <SubscriptionMode
            t={t}
            plans={plans}
            planFilter={planFilter}
            setPlanFilter={setPlanFilter}
            subKeyword={subKeyword}
            setSubKeyword={setSubKeyword}
            subLoading={subLoading}
            filteredSubCodes={filteredSubCodes}
            loadSubscriptionCodes={loadSubscriptionCodes}
            copyAllUnusedSub={copyAllUnusedSub}
            deleteSubscriptionCode={deleteSubscriptionCode}
            openGenerator={() => setShowSubGenerator(true)}
          />
        )}
      </div>

      {/* Quota code editor (slide over) */}
      <EditRedemptionModal
        refresh={data.refresh}
        editingRedemption={data.editingRedemption}
        visiable={data.showEdit}
        handleClose={data.closeEdit}
      />

      {/* Subscription code batch generator */}
      <SubscriptionCodeBatchModal
        visible={showSubGenerator}
        plans={plans}
        defaultPlanId={planFilter !== 'all' ? Number(planFilter) : null}
        onClose={() => setShowSubGenerator(false)}
        onCreated={() => {
          loadSubscriptionCodes();
        }}
        t={t}
      />
    </div>
  );
};

// ── Quota mode ─────────────────────────────────────────

const QuotaMode = ({ data, t }) => {
  const [keyword, setKeyword] = useState('');
  const { setFormApi, searchRedemptions } = data;

  // Wire a stable formApi shim so useRedemptionsData.getFormValues works.
  // Note: depend ONLY on keyword + the (stable) setter from the hook —
  // depending on `data` causes a fresh-object render loop that freezes
  // navigation away from this page.
  useEffect(() => {
    setFormApi({
      getValues: () => ({ searchKeyword: keyword }),
      reset: () => setKeyword(''),
      setValue: (f, v) => f === 'searchKeyword' && setKeyword(v || ''),
    });
  }, [keyword, setFormApi]);

  const search = () => searchRedemptions();
  const reset = () => {
    setKeyword('');
    setTimeout(() => searchRedemptions(), 0);
  };

  return (
    <>
      <div className='bg-ui-bg-elevated border border-ui-border rounded-xl p-3 mb-3 flex flex-col md:flex-row md:items-center justify-between gap-2'>
        <div className='flex flex-wrap items-center gap-1.5'>
          <button
            onClick={() => {
              data.setEditingRedemption({ id: undefined });
              data.setShowEdit(true);
            }}
            className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover whitespace-nowrap'
          >
            <Plus size={12} />
            {t('添加兑换码')}
          </button>
          <button
            onClick={data.batchCopyRedemptions}
            disabled={!data.selectedKeys.length}
            className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle disabled:opacity-40 whitespace-nowrap'
          >
            {t('复制所选')}
          </button>
          <button
            onClick={data.batchDeleteRedemptions}
            className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl border border-ui-danger/40 text-ui-danger hover:bg-ui-danger-bg whitespace-nowrap'
          >
            <Trash2 size={12} />
            {t('清除失效')}
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
          className='flex items-center gap-1.5'
        >
          <div className='relative w-full md:w-64'>
            <Search size={12} className='absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-3 pointer-events-none' />
            <input
              type='text'
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={t('关键字（ID 或名称）')}
              className={inputCls}
            />
            {keyword && (
              <button
                type='button'
                onClick={() => setKeyword('')}
                className='absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-subtle'
              >
                <X size={11} />
              </button>
            )}
          </div>
          <button
            type='submit'
            disabled={data.searching}
            className='inline-flex items-center px-3 py-1.5 text-xs rounded-xl border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle whitespace-nowrap disabled:opacity-50'
          >
            {data.searching ? t('查询中...') : t('查询')}
          </button>
          <button
            type='button'
            onClick={reset}
            className='inline-flex items-center px-3 py-1.5 text-xs rounded-xl border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle whitespace-nowrap'
          >
            {t('重置')}
          </button>
        </form>
      </div>

      <div className='bg-ui-bg-elevated border border-ui-border rounded-xl overflow-hidden'>
        <RedemptionsTable {...data} />
        {data.tokenCount > 0 && (
          <div className='border-t border-ui-divider'>
            <Pagination
              page={data.activePage}
              pageSize={data.pageSize}
              total={data.tokenCount}
              pageSizeOpts={[10, 20, 50, 100]}
              onChange={data.handlePageChange}
              onPageSizeChange={data.handlePageSizeChange}
            />
          </div>
        )}
      </div>
    </>
  );
};

// ── Subscription mode ──────────────────────────────────

const SubscriptionStatusPill = ({ status, t }) => {
  const enabled = status === 1;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
        enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-ui-text-3'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-ui-text-3'}`} />
      {enabled ? t('未使用') : t('已使用')}
    </span>
  );
};

const SubscriptionMode = ({
  t,
  plans,
  planFilter,
  setPlanFilter,
  subKeyword,
  setSubKeyword,
  subLoading,
  filteredSubCodes,
  loadSubscriptionCodes,
  copyAllUnusedSub,
  deleteSubscriptionCode,
  openGenerator,
}) => (
  <>
    <div className='bg-ui-bg-elevated border border-ui-border rounded-xl p-3 mb-3 flex flex-col md:flex-row md:items-center justify-between gap-2'>
      <div className='flex flex-wrap items-center gap-1.5'>
        <button
          onClick={openGenerator}
          disabled={plans.length === 0}
          className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover disabled:opacity-50 whitespace-nowrap'
        >
          <Plus size={12} />
          {t('生成订阅兑换码')}
        </button>
        <button
          onClick={loadSubscriptionCodes}
          disabled={subLoading}
          className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle disabled:opacity-50 whitespace-nowrap'
        >
          <RefreshCw size={12} className={subLoading ? 'animate-spin' : ''} />
          {t('刷新')}
        </button>
        <button
          onClick={copyAllUnusedSub}
          disabled={!filteredSubCodes.some((c) => c.status === 1)}
          className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle disabled:opacity-40 whitespace-nowrap'
        >
          {t('复制未使用')}
        </button>
      </div>
      <div className='flex items-center gap-1.5'>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className='px-2.5 py-1.5 text-xs bg-transparent border border-ui-border rounded-xl text-ui-text outline-none focus:border-ui-text-3 cursor-pointer'
        >
          <option value='all'>{t('全部套餐')}</option>
          {plans.map((p) => (
            <option key={p.plan.id} value={p.plan.id}>
              {p.plan.title}
            </option>
          ))}
        </select>
        <div className='relative w-full md:w-56'>
          <Search size={12} className='absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-3 pointer-events-none' />
          <input
            type='text'
            value={subKeyword}
            onChange={(e) => setSubKeyword(e.target.value)}
            placeholder={t('搜索 key / 名称 / 套餐')}
            className={inputCls}
          />
          {subKeyword && (
            <button
              onClick={() => setSubKeyword('')}
              className='absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-subtle'
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>
    </div>

    <div className='bg-ui-bg-elevated border border-ui-border rounded-xl overflow-hidden'>
      {subLoading ? (
        <div className='py-16 text-center text-ui-text-3 text-sm flex items-center justify-center gap-2'>
          <RefreshCw size={14} className='animate-spin' />
          {t('加载中...')}
        </div>
      ) : filteredSubCodes.length === 0 ? (
        <div className='py-16 text-center text-ui-text-3 text-sm'>{t('暂无兑换码')}</div>
      ) : (
        <div className='overflow-x-auto nice-scroll'>
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
                  <td className='px-3 py-3 align-middle text-sm text-ui-text-2 truncate max-w-[180px]'>
                    {c._plan_title || '-'}
                  </td>
                  <td className='px-3 py-3 align-middle'>
                    <code className='font-mono text-xs text-ui-text break-all select-all'>{c.key}</code>
                  </td>
                  <td className='px-3 py-3 align-middle text-xs text-ui-text-2 truncate max-w-[180px]'>{c.name || '-'}</td>
                  <td className='px-3 py-3 align-middle'>
                    <SubscriptionStatusPill status={c.status} t={t} />
                  </td>
                  <td className='px-3 py-3 align-middle text-right'>
                    <div className='flex items-center justify-end gap-1'>
                      <button
                        onClick={async () => {
                          if (await copy(c.key)) showSuccess(t('已复制'));
                          else showError(t('复制失败'));
                        }}
                        className='inline-flex items-center px-2 py-1 text-[11px] rounded border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle whitespace-nowrap'
                      >
                        {t('复制')}
                      </button>
                      <button
                        onClick={() => deleteSubscriptionCode(c.id)}
                        className='inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-ui-danger/30 text-ui-danger hover:bg-ui-danger-bg whitespace-nowrap'
                      >
                        <Trash2 size={11} />
                        {t('删除')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </>
);

export default RedemptionsPage;

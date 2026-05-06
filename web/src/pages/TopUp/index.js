/*
Copyright (C) 2025 QuantumNous

Modern minimalist wallet page.
*/

import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../../hooks/common/usePageTitle';
import { useSearchParams } from 'react-router-dom';
import {
  RefreshCw, Copy, Check, X,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import {
  API,
  showError,
  showSuccess,
  showInfo,
  copy,
  renderQuota,
  timestamp2string,
} from '../../helpers';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import Pagination from '../../components/common/table/Pagination';

// ── small atoms ────────────────────────────────────────

const Card = ({ title, action, children, className = '', bodyClass = 'p-5' }) => (
  <div
    className={`border border-ui-border rounded-[28px] ${className}`}
    style={{ backgroundColor: 'var(--page-bg)' }}
  >
    {(title || action) && (
      <div className='flex items-center justify-between gap-3 px-5 py-3.5'>
        {title && <div className='text-sm font-semibold text-ui-text'>{title}</div>}
        {action}
      </div>
    )}
    <div className={bodyClass}>{children}</div>
  </div>
);

const inputCls =
  'w-full px-3 py-2 text-sm bg-transparent border border-ui-border rounded-xl text-ui-text placeholder:text-ui-text-3 outline-none focus:border-ui-text-3 transition-colors';

const PrimaryBtn = ({ children, ...props }) => (
  <button
    {...props}
    className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover hover:shadow-md active:scale-95 disabled:opacity-50 disabled:hover:shadow-none disabled:active:scale-100 transition-all ${props.className || ''}`}
  >
    {children}
  </button>
);

const GhostBtn = ({ children, ...props }) => (
  <button
    {...props}
    className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors ${props.className || ''}`}
  >
    {children}
  </button>
);

// ── topup history modal ─────────────────────────────────

const TYPE_LABELS = {
  1: { label: '充值', color: '#22c55e' },
  2: { label: '消费', color: '#3b82f6' },
  6: { label: '退款', color: '#f59e0b' },
};

const HistoryModal = ({ open, onClose, t }) => {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        p: String(p),
        size: '15',
        type: '1', // 充值类型
      });
      const { data } = await API.get(`/api/log/self/?${params.toString()}`);
      if (data.success) {
        setItems(data.data.items || []);
        setTotal(data.data.total || 0);
        setPage(data.data.page || p);
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load(1);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = original;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className='fixed inset-0 z-[100] flex items-center justify-center p-4'
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className='border border-ui-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden'
        style={{ backgroundColor: 'var(--page-bg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className='flex items-center justify-between px-5 py-3.5'>
          <span className='text-sm font-semibold text-ui-text'>{t('充值记录')}</span>
          <button
            onClick={onClose}
            className='p-1 rounded text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle'
          >
            <X size={16} />
          </button>
        </div>
        <div className='flex-1 overflow-y-auto'>
          {loading && items.length === 0 ? (
            <div className='py-12 text-center text-ui-text-3 text-sm'>{t('加载中...')}</div>
          ) : items.length === 0 ? (
            <div className='py-12 text-center text-ui-text-3 text-sm'>{t('暂无记录')}</div>
          ) : (
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b border-ui-border bg-ui-bg-subtle/50 text-[11px] uppercase tracking-wider text-ui-text-3'>
                  <th className='text-left px-5 py-2.5 font-medium'>{t('时间')}</th>
                  <th className='text-left px-5 py-2.5 font-medium'>{t('内容')}</th>
                  <th className='text-right px-5 py-2.5 font-medium'>{t('额度')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((log, i) => (
                  <tr key={log.id || i} className='border-b border-ui-divider last:border-b-0'>
                    <td className='px-5 py-3 text-xs text-ui-text-2 whitespace-nowrap'>
                      {timestamp2string(log.created_at)}
                    </td>
                    <td className='px-5 py-3 text-ui-text'>
                      {log.content || '—'}
                    </td>
                    <td className='px-5 py-3 text-right tabular-nums text-ui-text font-medium'>
                      {log.quota > 0 ? renderQuota(log.quota) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {items.length > 0 && (
          <Pagination page={page} pageSize={15} total={total} onChange={load} />
        )}
      </div>
    </div>,
    document.body,
  );
};

// ── transfer modal ──────────────────────────────────────

const TransferModal = ({ open, max, onClose, onConfirm, t }) => {
  const [amount, setAmount] = useState(0);
  useEffect(() => {
    if (open) setAmount(0);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    const ov = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = ov;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className='fixed inset-0 z-[100] flex items-center justify-center p-4'
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className='border border-ui-border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden'
        style={{ backgroundColor: 'var(--page-bg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className='flex items-center justify-between px-5 py-3.5'>
          <span className='text-sm font-semibold text-ui-text'>{t('划转邀请额度')}</span>
          <button onClick={onClose} className='p-1 rounded text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle'>
            <X size={16} />
          </button>
        </div>
        <div className='p-5 space-y-3'>
          <div>
            <label className='block text-xs font-medium text-ui-text-2 mb-1.5'>
              {t('划转额度')}
            </label>
            <input
              type='number'
              min={0}
              max={max}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className={inputCls}
            />
            <p className='mt-1 text-[11px] text-ui-text-3'>
              {t('可划转：')} {renderQuota(max)}
            </p>
          </div>
        </div>
        <div className='flex justify-end gap-2 px-5 py-3'>
          <GhostBtn onClick={onClose}>{t('取消')}</GhostBtn>
          <PrimaryBtn onClick={() => onConfirm(amount)}>{t('确认')}</PrimaryBtn>
        </div>
      </div>
    </div>,
    document.body,
  );
};

// ── main ────────────────────────────────────────────────

const TopUp = () => {
  const { t } = useTranslation();
  usePageTitle(t('钱包管理'));
  const [searchParams] = useSearchParams();
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);

  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  const [topUpCount, setTopUpCount] = useState(statusState?.status?.min_topup || 1);
  const [paying, setPaying] = useState(false);

  const [affLink, setAffLink] = useState('');
  const [copyingAff, setCopyingAff] = useState(false);

  const [showHistory, setShowHistory] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [subscriptions, setSubscriptions] = useState([]);
  const [planMap, setPlanMap] = useState({});

  const minTopUp = statusState?.status?.min_topup || 1;
  const topUpLink = statusState?.status?.top_up_link || '';

  const refreshUser = async () => {
    setRefreshing(true);
    try {
      const { data } = await API.get('/api/user/self');
      if (data.success) userDispatch({ type: 'login', payload: data.data });
    } catch (e) {
      showError(e.message);
    } finally {
      setRefreshing(false);
    }
  };

  const loadSubscriptions = async () => {
    try {
      const [selfRes, plansRes] = await Promise.all([
        API.get('/api/subscription/self', { skipErrorHandler: true }),
        API.get('/api/subscription/plans', { skipErrorHandler: true }),
      ]);
      if (selfRes?.data?.success) {
        setSubscriptions(selfRes.data.data?.subscriptions || []);
      }
      if (plansRes?.data?.success) {
        const m = {};
        (plansRes.data.data || []).forEach((p) => {
          const id = p?.plan?.id;
          if (id) m[id] = p?.plan || {};
        });
        setPlanMap(m);
      }
    } catch {}
  };

  const loadAff = async () => {
    try {
      const { data } = await API.get('/api/user/aff');
      if (data.success) {
        const base = statusState?.status?.server_address || window.location.origin;
        setAffLink(`${base}/register?aff=${data.data}`);
      }
    } catch {}
  };

  useEffect(() => {
    refreshUser();
    loadAff();
    loadSubscriptions();
  }, []);

  // 兑换码 query 参数
  useEffect(() => {
    const c = searchParams.get('code');
    if (c) setCode(c);
  }, [searchParams]);

  const redeem = async () => {
    const key = code.trim();
    if (!key) {
      showInfo(t('请输入兑换码'));
      return;
    }
    setRedeeming(true);
    try {
      // First try subscription redemption — codes are 32-char UUID hashes
      // and the endpoint cleanly rejects non-subscription keys with a
      // generic "无效的兑换码" message that we fall back from.
      let handled = false;
      try {
        const subRes = await API.post(
          '/api/subscription/redeem',
          { key },
          { skipErrorHandler: true },
        );
        if (subRes.data?.success) {
          showSuccess(
            t('已激活订阅：') + (subRes.data.data?.plan_title || ''),
          );
          setCode('');
          await refreshUser();
          await loadSubscriptions();
          handled = true;
        } else if (
          subRes.data?.message &&
          !/无效的兑换码|invalid/i.test(subRes.data.message)
        ) {
          // Real error (e.g., expired, plan disabled) — surface it.
          showError(subRes.data.message);
          handled = true;
        }
      } catch {
        // Network/skipped error — fall through to quota redemption.
      }

      if (handled) return;

      const { data } = await API.post('/api/user/topup', { key });
      if (data.success) {
        showSuccess(t('兑换成功！获得 ') + renderQuota(data.data));
        setCode('');
        if (userState.user) {
          userDispatch({
            type: 'login',
            payload: { ...userState.user, quota: userState.user.quota + data.data },
          });
        }
      } else {
        showError(data.message);
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setRedeeming(false);
    }
  };

  const goRecharge = () => {
    if (topUpLink) {
      window.open(topUpLink, '_blank');
    } else {
      showInfo(t('管理员未配置充值链接'));
    }
  };

  const copyAff = async () => {
    if (!affLink) return;
    const ok = await copy(affLink);
    if (ok) {
      setCopyingAff(true);
      showSuccess(t('已复制邀请链接'));
      setTimeout(() => setCopyingAff(false), 1500);
    }
  };

  const transferAff = async (amount) => {
    if (!amount || amount <= 0) {
      showError(t('请输入有效金额'));
      return;
    }
    try {
      const { data } = await API.post('/api/user/aff_transfer', { quota: amount });
      if (data.success) {
        showSuccess(t('划转成功'));
        setShowTransfer(false);
        refreshUser();
      } else {
        showError(data.message);
      }
    } catch (e) {
      showError(e.message);
    }
  };

  const u = userState?.user || {};
  const quota = u.quota || 0;
  const usedQuota = u.used_quota || 0;
  const affQuota = u.aff_quota || 0;
  const affCount = u.aff_count || 0;
  const affHistoryQuota = u.aff_history_quota || 0;

  return (
    <div
      className='min-h-[calc(100vh-4rem)] px-4 py-6 md:px-6 md:py-8'
      style={{ backgroundColor: 'var(--page-bg)' }}
    >
      <div className='max-w-5xl mx-auto'>
        {/* Header */}
        <div className='flex items-center justify-between gap-3 mb-5'>
          <h1
            className='text-2xl md:text-3xl font-medium text-ui-text'
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}
          >
            {t('钱包管理')}
          </h1>
          <div className='flex items-center gap-1'>
            <button
              onClick={refreshUser}
              title={t('刷新')}
              className='inline-flex items-center justify-center w-9 h-9 rounded-lg text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors'
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Balance hero */}
        <div
          className='relative overflow-hidden border border-ui-border rounded-[28px] p-6 md:p-8 mb-5'
          style={{ backgroundColor: 'var(--page-bg)' }}
        >
          <div className='relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6'>
            <div className='md:col-span-2'>
              <div className='text-ui-text-3 text-xs uppercase tracking-widest mb-3'>
                {t('当前余额')}
              </div>
              <div
                className='text-4xl md:text-5xl font-medium text-ui-text tabular-nums'
                style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}
              >
                {renderQuota(quota)}
              </div>
              <p className='mt-2 text-sm text-ui-text-3'>
                {t('累计已使用')} {renderQuota(usedQuota)}
              </p>
            </div>
            <div className='flex flex-col justify-end gap-2'>
              <GhostBtn onClick={() => setShowHistory(true)}>
                {t('查看记录')}
              </GhostBtn>
            </div>
          </div>
        </div>

        {/* My subscriptions */}
        {subscriptions.length > 0 && (
          <Card title={<span>{t('我的订阅')}</span>} className='mb-5'>
            <div className='space-y-3'>
              {subscriptions.map((row) => {
                const sub = row?.subscription || {};
                const plan = planMap[sub.plan_id] || {};
                const planTitle = plan.title || (sub.plan_id ? `#${sub.plan_id}` : '—');
                const planSubtitle = plan.subtitle || '';
                const total = Number(sub.amount_total || 0);
                const used = Number(sub.amount_used || 0);
                const remaining = Math.max(0, total - used);
                const usagePct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
                const unlimited = total === 0;
                const now = Date.now() / 1000;
                const expired = (sub.end_time || 0) > 0 && (sub.end_time || 0) < now;
                const cancelled = sub.status === 'cancelled';
                const active = sub.status === 'active' && !expired && !cancelled;
                const daysLeft = active && sub.end_time
                  ? Math.max(0, Math.ceil((sub.end_time - now) / 86400))
                  : 0;
                const nextResetDays = active && sub.next_reset_time && sub.next_reset_time > now
                  ? Math.max(0, Math.ceil((sub.next_reset_time - now) / 86400))
                  : 0;
                const durationLabel = (() => {
                  if (!plan.duration_unit) return '';
                  const v = plan.duration_value;
                  const unit = plan.duration_unit;
                  if (unit === 'year') return `${v} ${t('年')}`;
                  if (unit === 'month') return `${v} ${t('月')}`;
                  if (unit === 'day') return `${v} ${t('天')}`;
                  if (unit === 'hour') return `${v} ${t('小时')}`;
                  if (unit === 'custom') return t('自定义');
                  return '';
                })();
                const resetLabel = (() => {
                  const p = plan.quota_reset_period;
                  if (!p || p === 'never') return t('不重置');
                  if (p === 'daily') return t('每日');
                  if (p === 'weekly') return t('每周');
                  if (p === 'monthly') return t('每月');
                  if (p === 'custom') return t('自定义');
                  return p;
                })();
                return (
                  <div
                    key={sub.id}
                    className='border border-ui-border rounded-lg p-4 bg-ui-bg'
                  >
                    {/* Header */}
                    <div className='flex flex-wrap items-start justify-between gap-2 mb-3'>
                      <div className='min-w-0 flex-1'>
                        <div className='flex items-center gap-2 flex-wrap'>
                          <span className='text-sm font-semibold text-ui-text truncate'>
                            {planTitle}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium whitespace-nowrap ${
                              active
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : cancelled
                                  ? 'bg-gray-500/10 text-gray-500 border-gray-500/20'
                                  : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                            }`}
                          >
                            {active ? t('生效中') : cancelled ? t('已取消') : t('已过期')}
                          </span>
                        </div>
                        {planSubtitle && (
                          <div className='text-[11px] text-ui-text-3 mt-0.5'>{planSubtitle}</div>
                        )}
                      </div>
                      {active && daysLeft > 0 && (
                        <div className='text-right flex-shrink-0'>
                          <div className='text-xs font-semibold text-ui-text tabular-nums'>
                            {daysLeft}
                          </div>
                          <div className='text-[10px] text-ui-text-3'>{t('天剩余')}</div>
                        </div>
                      )}
                    </div>

                    {/* Quota usage */}
                    {unlimited ? (
                      <div className='flex items-center justify-between text-xs text-ui-text-2 mb-3 px-3 py-2 rounded-md bg-ui-bg-subtle'>
                        <span>{t('额度用量')}</span>
                        <span className='font-semibold text-ui-text'>{t('不限额度')}</span>
                      </div>
                    ) : (
                      <div className='mb-3'>
                        <div className='flex items-center justify-between text-[11px] text-ui-text-3 mb-1.5 tabular-nums'>
                          <span>
                            {t('已用')}{' '}
                            <span className='text-ui-text font-semibold'>{renderQuota(used)}</span>
                            {' / '}{renderQuota(total)}
                          </span>
                          <span>
                            {t('剩余')}{' '}
                            <span className='text-ui-text font-semibold'>{renderQuota(remaining)}</span>
                          </span>
                        </div>
                        <div className='w-full h-2 rounded-full bg-ui-bg-subtle overflow-hidden'>
                          <div
                            className='h-full rounded-full transition-all'
                            style={{
                              width: `${usagePct}%`,
                              background:
                                usagePct >= 90
                                  ? 'rgb(239, 68, 68)'
                                  : usagePct >= 70
                                    ? 'rgb(245, 158, 11)'
                                    : 'var(--ui-brand)',
                            }}
                          />
                        </div>
                        <div className='flex items-center justify-between text-[10px] text-ui-text-3 mt-1 tabular-nums'>
                          <span>{usagePct.toFixed(1)}%</span>
                          {nextResetDays > 0 && (
                            <span>
                              {t('额度重置剩余')} {nextResetDays} {t('天')}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Detail grid */}
                    <div className='grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] tabular-nums pt-3 border-t border-ui-divider'>
                      <div>
                        <div className='text-[10px] uppercase tracking-wider text-ui-text-3 mb-0.5'>
                          {t('开始日期')}
                        </div>
                        <div className='text-ui-text-2'>
                          {sub.start_time
                            ? new Date(sub.start_time * 1000).toLocaleDateString()
                            : '—'}
                        </div>
                      </div>
                      <div>
                        <div className='text-[10px] uppercase tracking-wider text-ui-text-3 mb-0.5'>
                          {t('到期日期')}
                        </div>
                        <div className='text-ui-text-2'>
                          {sub.end_time
                            ? new Date(sub.end_time * 1000).toLocaleDateString()
                            : '—'}
                        </div>
                      </div>
                      {durationLabel && (
                        <div>
                          <div className='text-[10px] uppercase tracking-wider text-ui-text-3 mb-0.5'>
                            {t('套餐时长')}
                          </div>
                          <div className='text-ui-text-2'>{durationLabel}</div>
                        </div>
                      )}
                      <div>
                        <div className='text-[10px] uppercase tracking-wider text-ui-text-3 mb-0.5'>
                          {t('额度重置')}
                        </div>
                        <div className='text-ui-text-2'>{resetLabel}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Two-column: redeem code + recharge (recharge only when top-up link is configured) */}
        <div className={`grid grid-cols-1 ${topUpLink ? 'md:grid-cols-2' : ''} gap-4 mb-5`}>
          {/* Redeem code */}
          <Card title={<span>{t('兑换码')}</span>}>
            <p className='text-xs text-ui-text-3 mb-3'>
              {t('输入管理员发放的兑换码，立即获得对应额度')}
            </p>
            <div className='flex gap-2'>
              <input
                type='text'
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && redeem()}
                placeholder='XXXX-XXXX-XXXX-XXXX'
                className={`${inputCls} font-mono`}
              />
              <PrimaryBtn onClick={redeem} disabled={redeeming || !code.trim()} className='whitespace-nowrap flex-shrink-0'>
                {redeeming ? t('兑换中...') : t('兑换')}
              </PrimaryBtn>
            </div>
          </Card>

          {/* Recharge amount */}
          {topUpLink && (
          <Card title={<span>{t('快捷充值')}</span>}>
            <p className='text-xs text-ui-text-3 mb-3'>
              {t('支持多种支付方式，跳转到充值页面完成支付')}
            </p>
            <div className='flex flex-wrap gap-1.5 mb-3'>
              {[10, 50, 100, 500].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setTopUpCount(amt)}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                    topUpCount === amt
                      ? 'bg-ui-bg-subtle text-ui-text font-semibold border border-ui-text-3'
                      : 'border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle'
                  }`}
                >
                  ${amt}
                </button>
              ))}
              <input
                type='number'
                min={minTopUp}
                value={topUpCount}
                onChange={(e) => setTopUpCount(Number(e.target.value))}
                className='w-24 px-3 py-1.5 text-xs bg-ui-bg border border-ui-border rounded-md text-ui-text outline-none focus:border-ui-text-3'
              />
            </div>
            <PrimaryBtn className='w-full' onClick={goRecharge} disabled={paying}>
              {paying ? t('处理中...') : t('前往充值')}
            </PrimaryBtn>
          </Card>
          )}
        </div>

        {/* Affiliate */}
        <Card
          title={<span>{t('邀请奖励')}</span>}
          action={
            <button
              onClick={() => setShowTransfer(true)}
              disabled={affQuota <= 0}
              className='inline-flex items-center px-2.5 py-1 text-xs rounded-md text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle disabled:opacity-40 disabled:hover:bg-transparent transition-colors'
            >
              {t('划转到余额')}
            </button>
          }
        >
          <div className='grid grid-cols-3 gap-4 mb-4'>
            <div>
              <div className='text-[11px] uppercase tracking-wider text-ui-text-3 mb-1'>
                {t('邀请人数')}
              </div>
              <div className='text-2xl font-medium text-ui-text tabular-nums'>{affCount}</div>
            </div>
            <div>
              <div className='text-[11px] uppercase tracking-wider text-ui-text-3 mb-1'>
                {t('可用奖励')}
              </div>
              <div className='text-2xl font-medium text-ui-text tabular-nums'>{renderQuota(affQuota)}</div>
            </div>
            <div>
              <div className='text-[11px] uppercase tracking-wider text-ui-text-3 mb-1'>
                {t('累计奖励')}
              </div>
              <div className='text-2xl font-medium text-ui-text-2 tabular-nums'>{renderQuota(affHistoryQuota)}</div>
            </div>
          </div>

          {affLink && (
            <div className='flex items-center gap-2 p-2 bg-ui-bg-subtle border border-ui-border rounded-lg'>
              <code className='flex-1 text-[12px] font-mono text-ui-text-2 truncate select-all'>
                {affLink}
              </code>
              <button
                onClick={copyAff}
                className='inline-flex items-center justify-center w-8 h-8 rounded-md text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-elevated transition-colors flex-shrink-0'
              >
                {copyingAff ? <Check size={14} className='text-ui-brand' /> : <Copy size={14} />}
              </button>
            </div>
          )}
        </Card>
      </div>

      {/* Modals */}
      <HistoryModal open={showHistory} onClose={() => setShowHistory(false)} t={t} />
      <TransferModal
        open={showTransfer}
        max={affQuota}
        onClose={() => setShowTransfer(false)}
        onConfirm={transferAff}
        t={t}
      />
    </div>
  );
};

export default TopUp;

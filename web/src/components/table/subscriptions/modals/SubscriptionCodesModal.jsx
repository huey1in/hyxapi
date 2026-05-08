/*
 * Subscription redemption codes modal — admin generates / lists / deletes
 * codes that activate this plan when redeemed by a user on the wallet page.
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X, Plus, Copy, Trash2, RefreshCw } from 'lucide-react';
import { API, copy, showError, showSuccess } from '../../../../helpers';
import { showConfirm } from '../../../common/ConfirmDialog';
import {
  TextField,
  NumberField,
  FieldRow,
} from '../../../common/form/Primitives';

const StatusPill = ({ status, t }) => {
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

const SectionCard = ({ title, description, children, headerExtra }) => (
  <div className='border border-ui-border rounded-2xl p-4'>
    <div className='flex items-center justify-between gap-3 mb-3'>
      <div className='min-w-0'>
        <div className='text-sm font-semibold text-ui-text truncate'>{title}</div>
        {description && <div className='text-[11px] text-ui-text-3 truncate'>{description}</div>}
      </div>
      {headerExtra && <div className='flex items-center gap-1 flex-shrink-0'>{headerExtra}</div>}
    </div>
    {children}
  </div>
);

const SubscriptionCodesModal = ({ visible, onClose, plan, t }) => {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [codes, setCodes] = useState([]);
  const [count, setCount] = useState(1);
  const [name, setName] = useState('');

  const planId = plan?.plan?.id;

  useEffect(() => {
    if (!visible || !planId) return;
    void load();
    setCount(1);
    setName(plan?.plan?.title || '');
    const onKey = (e) => e.key === 'Escape' && !generating && onClose?.();
    document.addEventListener('keydown', onKey);
    const ov = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = ov;
    };
  }, [visible, planId]); // eslint-disable-line

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await API.get(`/api/subscription/admin/plans/${planId}/codes`);
      if (data?.success) setCodes(data.data || []);
      else showError(data?.message || t('加载失败'));
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const generate = async () => {
    if (count < 1) return showError(t('生成数量必须大于 0'));
    setGenerating(true);
    try {
      const { data } = await API.post(`/api/subscription/admin/plans/${planId}/codes`, {
        count: Math.floor(count),
        name,
        expired_time: 0,
      });
      if (data?.success) {
        showSuccess(t('已生成 {{n}} 条兑换码', { n: data.data?.length || count }));
        await load();
      } else {
        showError(data?.message || t('生成失败'));
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const removeCode = (id) => {
    showConfirm({
      title: t('确认删除该兑换码？'),
      content: t('删除后用户将无法再使用该兑换码。已使用的兑换码可放心删除，不影响已激活的订阅。'),
      danger: true,
      onOk: async () => {
        try {
          const { data } = await API.delete(`/api/subscription/admin/codes/${id}`);
          if (data?.success) {
            showSuccess(t('已删除'));
            await load();
          } else {
            showError(data?.message || t('删除失败'));
          }
        } catch (e) {
          showError(e.message);
        }
      },
    });
  };

  const handleCopy = async (key) => {
    if (await copy(key)) showSuccess(t('已复制'));
    else showError(t('复制失败'));
  };

  const handleCopyAllUnused = async () => {
    const unused = codes.filter((c) => c.status === 1).map((c) => c.key);
    if (!unused.length) return showError(t('没有未使用的兑换码'));
    if (await copy(unused.join('\n'))) {
      showSuccess(t('已复制 {{n}} 条', { n: unused.length }));
    } else {
      showError(t('复制失败'));
    }
  };

  if (!visible || typeof document === 'undefined') return null;

  const unusedCount = codes.filter((c) => c.status === 1).length;

  return createPortal(
    <div
      className='fixed inset-0 z-[125] flex items-center justify-center p-4'
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
      onClick={generating ? undefined : onClose}
    >
      <div
        className='border border-ui-border rounded-[28px] shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden'
        style={{ backgroundColor: 'var(--page-bg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className='flex items-center justify-between gap-3 px-5 py-4 border-b border-ui-border flex-shrink-0'>
          <div className='flex items-center gap-2 min-w-0'>
            <span className='text-base font-semibold text-ui-text truncate'>
              {t('订阅兑换码')}
            </span>
            {plan?.plan?.title && (
              <span className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-lg border border-ui-border text-ui-text-2 truncate max-w-[200px]'>
                {plan.plan.title}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className='inline-flex items-center justify-center w-9 h-9 rounded-xl text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors'
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className='p-5 space-y-4 overflow-y-auto flex-1'>
          {/* Generator */}
          <SectionCard
            title={t('生成新兑换码')}
            description={t('为该套餐生成可被用户兑换激活的码')}
          >
            <div className='grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end'>
              <FieldRow label={t('备注')}>
                <TextField
                  value={name}
                  onChange={setName}
                  placeholder={t('便于识别（可选）')}
                />
              </FieldRow>
              <FieldRow label={t('数量')}>
                <NumberField
                  value={count}
                  onChange={(v) => setCount(Math.max(1, Math.min(200, Math.floor(v))))}
                  min={1}
                  max={200}
                />
              </FieldRow>
              <button
                onClick={generate}
                disabled={generating}
                className='inline-flex items-center justify-center gap-1.5 h-9 px-4 text-sm font-semibold rounded-xl bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover disabled:opacity-50 transition-colors whitespace-nowrap'
              >
                {generating ? <Loader2 size={13} className='animate-spin' /> : <Plus size={13} />}
                {t('生成')}
              </button>
            </div>
          </SectionCard>

          {/* Codes list */}
          <SectionCard
            title={t('已生成的兑换码')}
            description={
              codes.length > 0
                ? t('共 {{total}} 条 · 未使用 {{unused}} 条', { total: codes.length, unused: unusedCount })
                : null
            }
            headerExtra={
              <>
                <button
                  onClick={handleCopyAllUnused}
                  disabled={unusedCount === 0}
                  className='inline-flex items-center gap-1 h-8 px-2.5 text-[11px] rounded-lg border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle disabled:opacity-40 transition-colors whitespace-nowrap'
                >
                  <Copy size={11} />
                  {t('复制未使用')}
                </button>
                <button
                  onClick={load}
                  disabled={loading}
                  title={t('刷新')}
                  className='inline-flex items-center justify-center w-8 h-8 rounded-lg text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle disabled:opacity-40 transition-colors'
                >
                  <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                </button>
              </>
            }
          >
            {loading ? (
              <div className='py-10 text-center text-ui-text-3 text-sm flex items-center justify-center gap-2'>
                <Loader2 size={14} className='animate-spin' />
                {t('加载中...')}
              </div>
            ) : codes.length === 0 ? (
              <div className='py-10 text-center text-ui-text-3 text-sm'>
                {t('暂无兑换码')}
              </div>
            ) : (
              <div className='divide-y divide-ui-divider max-h-96 overflow-y-auto -mx-1'>
                {codes.map((c) => (
                  <div
                    key={c.id}
                    className='flex items-center justify-between gap-3 px-1 py-2.5 hover:bg-ui-bg-subtle/40 rounded-md'
                  >
                    <div className='flex-1 min-w-0'>
                      <div className='font-mono text-xs text-ui-text break-all select-all'>
                        {c.key}
                      </div>
                      {c.name && (
                        <div className='text-[11px] text-ui-text-3 mt-0.5 truncate'>
                          {c.name}
                        </div>
                      )}
                    </div>
                    <StatusPill status={c.status} t={t} />
                    <button
                      onClick={() => handleCopy(c.key)}
                      className='inline-flex items-center justify-center w-8 h-8 rounded-lg text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle flex-shrink-0 transition-colors'
                      title={t('复制')}
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      onClick={() => removeCode(c.id)}
                      className='inline-flex items-center justify-center w-8 h-8 rounded-lg text-ui-danger hover:bg-ui-danger-bg flex-shrink-0 transition-colors'
                      title={t('删除')}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Footer */}
        <div className='flex justify-end gap-2 px-5 py-4 border-t border-ui-border flex-shrink-0'>
          <button
            onClick={onClose}
            className='inline-flex items-center h-9 px-4 text-sm font-semibold rounded-xl bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover transition-colors whitespace-nowrap'
          >
            {t('完成')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default SubscriptionCodesModal;

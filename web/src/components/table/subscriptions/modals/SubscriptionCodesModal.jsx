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

  return createPortal(
    <div
      className='fixed inset-0 z-[125] flex items-center justify-center p-4'
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={generating ? undefined : onClose}
    >
      <div
        className='bg-ui-bg-elevated border border-ui-border rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='flex items-center justify-between gap-3 px-5 py-3.5 border-b border-ui-border'>
          <div className='flex items-center gap-2 min-w-0'>
            <span className='text-sm font-semibold text-ui-text truncate'>
              {t('订阅兑换码')}
            </span>
            <span className='text-xs text-ui-text-3 truncate'>
              {plan?.plan?.title}
            </span>
          </div>
          <button onClick={onClose} className='p-1 rounded text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle'>
            <X size={16} />
          </button>
        </div>

        <div className='p-5 space-y-4 overflow-y-auto flex-1'>
          {/* Generator */}
          <div className='border border-ui-border rounded-lg p-4 bg-ui-bg-subtle'>
            <div className='text-sm font-semibold text-ui-text mb-3'>{t('生成新兑换码')}</div>
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
                className='inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-md bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover disabled:opacity-50 whitespace-nowrap'
              >
                {generating ? <Loader2 size={13} className='animate-spin' /> : <Plus size={13} />}
                {t('生成')}
              </button>
            </div>
          </div>

          {/* Codes list */}
          <div className='border border-ui-border rounded-lg overflow-hidden'>
            <div className='flex items-center justify-between px-3 py-2 bg-ui-bg-subtle/50 border-b border-ui-border'>
              <div className='flex items-center gap-2 text-xs text-ui-text-2'>
                <span>{t('共 {{n}} 条', { n: codes.length })}</span>
                <span className='text-ui-text-3'>·</span>
                <span>
                  {t('未使用 {{n}} 条', { n: codes.filter((c) => c.status === 1).length })}
                </span>
              </div>
              <div className='flex items-center gap-1'>
                <button
                  onClick={handleCopyAllUnused}
                  disabled={!codes.some((c) => c.status === 1)}
                  className='inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle disabled:opacity-40 whitespace-nowrap'
                >
                  <Copy size={11} />
                  {t('复制未使用')}
                </button>
                <button
                  onClick={load}
                  disabled={loading}
                  className='inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle disabled:opacity-40 whitespace-nowrap'
                >
                  <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
                  {t('刷新')}
                </button>
              </div>
            </div>
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
              <div className='divide-y divide-ui-divider max-h-96 overflow-y-auto'>
                {codes.map((c) => (
                  <div key={c.id} className='flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-ui-bg-subtle/40'>
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
                      className='p-1.5 rounded text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle flex-shrink-0'
                      title={t('复制')}
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      onClick={() => removeCode(c.id)}
                      className='p-1.5 rounded text-ui-danger hover:bg-ui-danger-bg flex-shrink-0'
                      title={t('删除')}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className='flex justify-end gap-2 px-5 py-3 border-t border-ui-border'>
          <button
            onClick={onClose}
            className='inline-flex items-center px-4 py-1.5 text-xs font-semibold rounded-md bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover whitespace-nowrap'
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

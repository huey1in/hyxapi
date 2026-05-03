/*
 * Subscription redemption code batch generator — used from the redemption
 * admin page (订阅 tab) to mint codes against a chosen plan.
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X, Plus, Copy } from 'lucide-react';
import { API, copy, showError, showSuccess } from '../../../../helpers';
import {
  TextField,
  NumberField,
  NativeSelect,
  FieldRow,
} from '../../../common/form/Primitives';

const SubscriptionCodeBatchModal = ({
  visible,
  plans,
  defaultPlanId,
  onClose,
  onCreated,
  t,
}) => {
  const [planId, setPlanId] = useState('');
  const [name, setName] = useState('');
  const [count, setCount] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(null); // {keys: [], plan_title}

  useEffect(() => {
    if (!visible) return;
    const initial =
      defaultPlanId && plans.some((p) => p.plan.id === defaultPlanId)
        ? String(defaultPlanId)
        : plans.length > 0
          ? String(plans[0].plan.id)
          : '';
    setPlanId(initial);
    setName(plans.find((p) => String(p.plan.id) === initial)?.plan?.title || '');
    setCount(1);
    setGenerated(null);
    const onKey = (e) => e.key === 'Escape' && !generating && onClose?.();
    document.addEventListener('keydown', onKey);
    const ov = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = ov;
    };
  }, [visible, defaultPlanId, plans]); // eslint-disable-line

  const generate = async () => {
    if (!planId) return showError(t('请选择套餐'));
    if (count < 1) return showError(t('数量必须大于 0'));
    setGenerating(true);
    try {
      const { data } = await API.post(
        `/api/subscription/admin/plans/${planId}/codes`,
        { count: Math.floor(count), name, expired_time: 0 },
      );
      if (data?.success) {
        const keys = (data.data || []).map((c) => c.key);
        const planTitle =
          plans.find((p) => String(p.plan.id) === String(planId))?.plan?.title || '';
        setGenerated({ keys, plan_title: planTitle });
        showSuccess(t('已生成 {{n}} 条', { n: keys.length }));
        onCreated?.();
      } else {
        showError(data?.message || t('生成失败'));
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const copyAll = async () => {
    if (!generated?.keys?.length) return;
    if (await copy(generated.keys.join('\n'))) {
      showSuccess(t('已复制 {{n}} 条', { n: generated.keys.length }));
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
        className='bg-ui-bg-elevated border border-ui-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='flex items-center justify-between gap-3 px-5 py-3.5 border-b border-ui-border'>
          <span className='text-sm font-semibold text-ui-text'>{t('生成订阅兑换码')}</span>
          <button
            onClick={onClose}
            disabled={generating}
            className='p-1 rounded text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle disabled:opacity-40'
          >
            <X size={16} />
          </button>
        </div>

        <div className='p-5 space-y-3'>
          {!generated ? (
            <>
              <FieldRow label={t('套餐')} required>
                <NativeSelect
                  value={planId}
                  onChange={(v) => {
                    setPlanId(v);
                    const plan = plans.find((p) => String(p.plan.id) === v);
                    if (plan) setName(plan.plan.title);
                  }}
                  options={plans.map((p) => ({
                    value: String(p.plan.id),
                    label: `${p.plan.title}${p.plan.enabled ? '' : ` (${t('已禁用')})`}`,
                  }))}
                />
              </FieldRow>
              <FieldRow label={t('备注')} hint={t('便于识别（可选）')}>
                <TextField value={name} onChange={setName} placeholder={t('备注')} />
              </FieldRow>
              <FieldRow label={t('数量')} hint={t('单次最多 200 条')}>
                <NumberField
                  value={count}
                  onChange={(v) => setCount(Math.max(1, Math.min(200, Math.floor(v))))}
                  min={1}
                  max={200}
                />
              </FieldRow>
            </>
          ) : (
            <>
              <div className='text-xs text-ui-text-2'>
                {t('已为「{{plan}}」生成 {{n}} 条兑换码：', {
                  plan: generated.plan_title,
                  n: generated.keys.length,
                })}
              </div>
              <pre className='text-[11px] font-mono bg-ui-bg-subtle border border-ui-border rounded-md p-3 max-h-72 overflow-auto whitespace-pre-wrap break-all'>
                {generated.keys.join('\n')}
              </pre>
            </>
          )}
        </div>

        <div className='flex justify-end gap-2 px-5 py-3 border-t border-ui-border'>
          {!generated ? (
            <>
              <button
                onClick={onClose}
                disabled={generating}
                className='inline-flex items-center px-3.5 py-1.5 text-xs font-medium rounded-md border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle disabled:opacity-40 whitespace-nowrap'
              >
                {t('取消')}
              </button>
              <button
                onClick={generate}
                disabled={generating || !planId}
                className='inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover disabled:opacity-50 whitespace-nowrap'
              >
                {generating ? <Loader2 size={11} className='animate-spin' /> : <Plus size={11} />}
                {t('生成')}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setGenerated(null)}
                className='inline-flex items-center px-3.5 py-1.5 text-xs font-medium rounded-md border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle whitespace-nowrap'
              >
                {t('再生成')}
              </button>
              <button
                onClick={copyAll}
                className='inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs rounded-md border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle whitespace-nowrap'
              >
                <Copy size={11} />
                {t('复制全部')}
              </button>
              <button
                onClick={onClose}
                className='inline-flex items-center px-4 py-1.5 text-xs font-semibold rounded-md bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover whitespace-nowrap'
              >
                {t('完成')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default SubscriptionCodeBatchModal;

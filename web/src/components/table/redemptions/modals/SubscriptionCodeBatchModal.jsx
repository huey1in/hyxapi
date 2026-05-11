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
import { Button, IconButton } from '../../../ui';

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
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
      onClick={generating ? undefined : onClose}
    >
      <div
        className='border border-ui-border rounded-[20px] shadow-2xl w-full max-w-lg overflow-hidden'
        style={{ backgroundColor: 'var(--page-bg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className='flex items-center justify-between gap-3 px-5 py-4 border-b border-ui-border'>
          <span className='text-base font-semibold text-ui-text truncate'>
            {generated ? t('生成成功') : t('生成订阅兑换码')}
          </span>
          <IconButton icon={X} onClick={onClose} disabled={generating} />
        </div>

        {/* Body */}
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
              <div className='text-xs text-ui-text-2 px-1'>
                {t('已为「{{plan}}」生成 {{n}} 条兑换码：', {
                  plan: generated.plan_title,
                  n: generated.keys.length,
                })}
              </div>
              <pre
                className='text-[11px] font-mono border border-ui-border rounded-2xl p-3 max-h-72 overflow-auto whitespace-pre-wrap break-all nice-scroll text-ui-text'
                style={{ backgroundColor: 'var(--page-bg)' }}
              >
                {generated.keys.join('\n')}
              </pre>
            </>
          )}
        </div>

        {/* Footer */}
        <div className='flex justify-end gap-2 px-5 py-4 border-t border-ui-border'>
          {!generated ? (
            <>
              <Button variant='secondary' onClick={onClose} disabled={generating}>
                {t('取消')}
              </Button>
              <Button
                icon={generating ? Loader2 : Plus}
                onClick={generate}
                disabled={generating || !planId}
              >
                {t('生成')}
              </Button>
            </>
          ) : (
            <>
              <Button variant='secondary' onClick={() => setGenerated(null)}>
                {t('再生成')}
              </Button>
              <Button variant='secondary' icon={Copy} onClick={copyAll}>
                {t('复制全部')}
              </Button>
              <Button onClick={onClose}>
                {t('完成')}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default SubscriptionCodeBatchModal;

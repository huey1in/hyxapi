/*
 * SubscriptionCodeBatchModal — 与 web-backup 同构。
 */

import React, { useEffect, useState } from 'react';
import { Loader2, Plus, Copy } from 'lucide-react';
import { API, copy, showError, showSuccess } from '../../../../helpers';
import { Modal, Button, Card, Input, NumberInput, Select, FieldRow } from '../../../ui';

const SubscriptionCodeBatchModal = ({ visible, plans, defaultPlanId, onClose, onCreated, t }) => {
  const [planId, setPlanId] = useState('');
  const [name, setName] = useState('');
  const [count, setCount] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(null);

  useEffect(() => {
    if (!visible) return;
    const initial = defaultPlanId && plans.some((p) => p.plan.id === defaultPlanId)
      ? String(defaultPlanId)
      : plans.length > 0 ? String(plans[0].plan.id) : '';
    setPlanId(initial);
    setName(plans.find((p) => String(p.plan.id) === initial)?.plan?.title || '');
    setCount(1);
    setGenerated(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, defaultPlanId, plans]);

  const generate = async () => {
    if (!planId) return showError(t('请选择套餐'));
    if (count < 1) return showError(t('数量必须大于 0'));
    setGenerating(true);
    try {
      const { data } = await API.post(`/api/subscription/admin/plans/${planId}/codes`, {
        count: Math.floor(count), name, expired_time: 0,
      });
      if (data?.success) {
        const keys = (data.data || []).map((c) => c.key);
        const planTitle = plans.find((p) => String(p.plan.id) === String(planId))?.plan?.title || '';
        setGenerated({ keys, plan_title: planTitle });
        showSuccess(t('已生成 {{n}} 条', { n: keys.length }));
        onCreated?.();
      } else showError(data?.message || t('生成失败'));
    } catch (e) { showError(e.message); }
    finally { setGenerating(false); }
  };

  const copyAll = async () => {
    if (!generated?.keys?.length) return;
    if (await copy(generated.keys.join('\n'))) showSuccess(t('已复制 {{n}} 条', { n: generated.keys.length }));
    else showError(t('复制失败'));
  };

  return (
    <Modal
      open={!!visible}
      onClose={onClose}
      title={generated ? t('生成成功') : t('生成订阅兑换码')}
      width={520}
      hideFooter
    >
      <div className='space-y-3'>
        {!generated ? (
          <>
            <FieldRow label={t('套餐')} required>
              <Select
                value={planId}
                onChange={(v) => { setPlanId(v); const plan = plans.find((p) => String(p.plan.id) === v); if (plan) setName(plan.plan.title); }}
                options={plans.map((p) => ({ value: String(p.plan.id), label: `${p.plan.title}${p.plan.enabled ? '' : ` (${t('已禁用')})`}` }))}
              />
            </FieldRow>
            <FieldRow label={t('备注')} hint={t('便于识别（可选）')}>
              <Input value={name} onChange={setName} placeholder={t('备注')} />
            </FieldRow>
            <FieldRow label={t('数量')} hint={t('单次最多 200 条')}>
              <NumberInput value={count} onChange={(v) => setCount(Math.max(1, Math.min(200, Math.floor(v))))} min={1} max={200} />
            </FieldRow>
          </>
        ) : (
          <>
            <div className='text-xs text-ui-text-2 px-1'>
              {t('已为「{{plan}}」生成 {{n}} 条兑换码：', { plan: generated.plan_title, n: generated.keys.length })}
            </div>
            <Card variant='filled'>
              <pre className='text-[11px] font-mono max-h-72 overflow-auto whitespace-pre-wrap break-all text-ui-text m-0'>{generated.keys.join('\n')}</pre>
            </Card>
          </>
        )}
      </div>
      <div className='flex justify-end gap-2 mt-4 pt-3 border-t border-ui-divider'>
        {!generated ? (
          <>
            <Button variant='toggle' onClick={onClose} disabled={generating}>{t('取消')}</Button>
            <Button icon={generating ? Loader2 : Plus} onClick={generate} loading={generating} disabled={!planId}>{t('生成')}</Button>
          </>
        ) : (
          <>
            <Button variant='toggle' onClick={() => setGenerated(null)}>{t('再生成')}</Button>
            <Button variant='toggle' icon={Copy} onClick={copyAll}>{t('复制全部')}</Button>
            <Button onClick={onClose}>{t('完成')}</Button>
          </>
        )}
      </div>
    </Modal>
  );
};

export default SubscriptionCodeBatchModal;

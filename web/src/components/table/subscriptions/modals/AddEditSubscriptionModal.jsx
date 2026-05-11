/*
 * Add / edit subscription plan — SlideOver with SectionCard layout to
 * match EditChannel / EditTag style.
 */
import React, { useEffect, useState } from 'react';
import { API, showError, showSuccess } from '../../../../helpers';
import {
  quotaToDisplayAmount,
  displayAmountToQuota,
} from '../../../../helpers/quota';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import SlideOver from '../../../common/SlideOver';
import {
  TextField,
  NumberField,
  NativeSelect,
  ToggleField,
  FieldRow,
} from '../../../common/form/Primitives';

const durationUnitOptions = (t) => [
  { value: 'year', label: t('年') },
  { value: 'month', label: t('月') },
  { value: 'day', label: t('日') },
  { value: 'hour', label: t('小时') },
  { value: 'custom', label: t('自定义(秒)') },
];

const resetPeriodOptions = (t) => [
  { value: 'never', label: t('不重置') },
  { value: 'daily', label: t('每天') },
  { value: 'weekly', label: t('每周') },
  { value: 'monthly', label: t('每月') },
  { value: 'custom', label: t('自定义(秒)') },
];

const DEFAULTS = {
  title: '',
  subtitle: '',
  price_amount: 0,
  currency: 'USD',
  duration_unit: 'month',
  duration_value: 1,
  custom_seconds: 0,
  quota_reset_period: 'never',
  quota_reset_custom_seconds: 0,
  enabled: true,
  sort_order: 0,
  max_purchase_per_user: 0,
  total_amount: 0,
  upgrade_group: '',
  stripe_price_id: '',
  creem_product_id: '',
};

const SectionCard = ({ title, description, children }) => (
  <div className='border border-ui-border rounded-2xl p-4'>
    <div className='mb-4'>
      <div className='text-sm font-semibold text-ui-text'>{title}</div>
      {description && <div className='text-[11px] text-ui-text-3 mt-0.5'>{description}</div>}
    </div>
    <div className='space-y-3'>{children}</div>
  </div>
);

const AddEditSubscriptionModal = ({
  visible,
  handleClose,
  editingPlan,
  placement = 'left',
  refresh,
  t,
}) => {
  const isMobile = useIsMobile();
  const isEdit = editingPlan?.plan?.id !== undefined;
  const [loading, setLoading] = useState(false);
  const [groupOptions, setGroupOptions] = useState([]);
  const [groupLoading, setGroupLoading] = useState(false);
  const [values, setValues] = useState(DEFAULTS);

  const buildFormValues = () => {
    if (!isEdit) return { ...DEFAULTS };
    const p = editingPlan.plan || {};
    return {
      ...DEFAULTS,
      title: p.title || '',
      subtitle: p.subtitle || '',
      price_amount: Number(p.price_amount || 0),
      currency: 'USD',
      duration_unit: p.duration_unit || 'month',
      duration_value: Number(p.duration_value || 1),
      custom_seconds: Number(p.custom_seconds || 0),
      quota_reset_period: p.quota_reset_period || 'never',
      quota_reset_custom_seconds: Number(p.quota_reset_custom_seconds || 0),
      enabled: p.enabled !== false,
      sort_order: Number(p.sort_order || 0),
      max_purchase_per_user: Number(p.max_purchase_per_user || 0),
      total_amount: Number(quotaToDisplayAmount(p.total_amount || 0).toFixed(2)),
      upgrade_group: p.upgrade_group || '',
      stripe_price_id: p.stripe_price_id || '',
      creem_product_id: p.creem_product_id || '',
    };
  };

  useEffect(() => {
    if (!visible) return;
    setValues(buildFormValues());
    setGroupLoading(true);
    API.get('/api/group')
      .then((res) => {
        if (res.data?.success) setGroupOptions(res.data?.data || []);
        else setGroupOptions([]);
      })
      .catch(() => setGroupOptions([]))
      .finally(() => setGroupLoading(false));
  }, [visible, editingPlan?.plan?.id]); // eslint-disable-line

  const set = (k, v) => setValues((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!values.title || values.title.trim() === '') {
      showError(t('套餐标题不能为空'));
      return;
    }
    setLoading(true);
    try {
      const payload = {
        plan: {
          ...values,
          price_amount: Number(values.price_amount || 0),
          currency: 'USD',
          duration_value: Number(values.duration_value || 0),
          custom_seconds: Number(values.custom_seconds || 0),
          quota_reset_period: values.quota_reset_period || 'never',
          quota_reset_custom_seconds:
            values.quota_reset_period === 'custom'
              ? Number(values.quota_reset_custom_seconds || 0)
              : 0,
          sort_order: Number(values.sort_order || 0),
          max_purchase_per_user: Number(values.max_purchase_per_user || 0),
          total_amount: displayAmountToQuota(values.total_amount),
          upgrade_group: values.upgrade_group || '',
        },
      };
      const res = isEdit
        ? await API.put(`/api/subscription/admin/plans/${editingPlan.plan.id}`, payload)
        : await API.post('/api/subscription/admin/plans', payload);
      if (res.data?.success) {
        showSuccess(isEdit ? t('更新成功') : t('创建成功'));
        handleClose();
        refresh?.();
      } else {
        showError(res.data?.message || (isEdit ? t('更新失败') : t('创建失败')));
      }
    } catch {
      showError(t('请求失败'));
    } finally {
      setLoading(false);
    }
  };

  const groupChoices = ['', ...groupOptions];

  return (
    <SlideOver
      open={visible}
      onClose={handleClose}
      placement={placement}
      width={isMobile ? window.innerWidth : 640}
      title={
        <>
          <span
            className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-xl ${
              isEdit
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {isEdit ? t('更新') : t('新建')}
          </span>
          <span className='text-base font-semibold text-ui-text truncate'>
            {isEdit ? t('更新套餐信息') : t('创建新的订阅套餐')}
          </span>
        </>
      }
      footer={
        <>
          <button
            onClick={handleClose}
            className='inline-flex items-center h-9 px-4 text-sm font-medium rounded-xl border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors whitespace-nowrap'
          >
            {t('取消')}
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className='inline-flex items-center h-9 px-4 text-sm font-semibold rounded-xl bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover disabled:opacity-50 transition-colors whitespace-nowrap'
          >
            {loading ? t('提交中...') : isEdit ? t('保存') : t('创建')}
          </button>
        </>
      }
      bodyClass='p-5 space-y-4'
    >
      {/* Basic info */}
      <SectionCard
        title={t('基本信息')}
        description={t('套餐的基本信息和定价')}
      >
        <FieldRow label={t('套餐标题')} required>
          <TextField
            value={values.title}
            onChange={(v) => set('title', v)}
            placeholder={t('例如：基础套餐')}
          />
        </FieldRow>
        <FieldRow label={t('套餐副标题')}>
          <TextField
            value={values.subtitle}
            onChange={(v) => set('subtitle', v)}
            placeholder={t('例如：适合轻度使用')}
          />
        </FieldRow>
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
          <FieldRow label={t('实付金额')} required>
            <NumberField
              value={values.price_amount}
              onChange={(v) => set('price_amount', v)}
              min={0}
              step={0.01}
            />
          </FieldRow>
          <FieldRow label={t('币种')} hint={t('由全站货币展示设置统一控制')}>
            <TextField value={values.currency} disabled />
          </FieldRow>
          <FieldRow label={t('排序')}>
            <NumberField
              value={values.sort_order}
              onChange={(v) => set('sort_order', Math.floor(v))}
            />
          </FieldRow>
          <FieldRow label={t('购买上限')} hint={t('0 表示不限')}>
            <NumberField
              value={values.max_purchase_per_user}
              onChange={(v) => set('max_purchase_per_user', Math.floor(v))}
              min={0}
            />
          </FieldRow>
        </div>
        <div className='pt-1'>
          <ToggleField
            label={t('启用状态')}
            checked={!!values.enabled}
            onChange={(v) => set('enabled', v)}
          />
        </div>
      </SectionCard>

      {/* Quota & group */}
      <SectionCard
        title={t('额度与分组')}
        description={t('订阅期间分配给用户的可用额度与升级分组')}
      >
        <FieldRow
          label={t('总额度')}
          required
          hint={`${t('0 表示不限')} · ${t('原生额度')}：${displayAmountToQuota(values.total_amount)}`}
        >
          <NumberField
            value={values.total_amount}
            onChange={(v) => set('total_amount', v)}
            min={0}
            step={0.01}
          />
        </FieldRow>
        <FieldRow
          label={t('升级分组')}
          hint={t('购买或手动新增订阅会升级到该分组；当套餐失效/过期或手动作废/删除后，将回退到升级前分组。回退不会立即生效，通常会有几分钟延迟。')}
        >
          <NativeSelect
            value={values.upgrade_group}
            onChange={(v) => set('upgrade_group', v)}
            disabled={groupLoading}
            options={groupChoices.map((g) => ({
              value: g,
              label: g === '' ? t('不升级') : g,
            }))}
          />
        </FieldRow>
      </SectionCard>

      {/* Duration */}
      <SectionCard
        title={t('有效期设置')}
        description={t('配置套餐的有效时长')}
      >
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
          <FieldRow label={t('有效期单位')} required>
            <NativeSelect
              value={values.duration_unit}
              onChange={(v) => set('duration_unit', v)}
              options={durationUnitOptions(t)}
            />
          </FieldRow>
          {values.duration_unit === 'custom' ? (
            <FieldRow label={t('自定义秒数')} required>
              <NumberField
                value={values.custom_seconds}
                onChange={(v) => set('custom_seconds', Math.floor(v))}
                min={1}
              />
            </FieldRow>
          ) : (
            <FieldRow label={t('有效期数值')} required>
              <NumberField
                value={values.duration_value}
                onChange={(v) => set('duration_value', Math.floor(v))}
                min={1}
              />
            </FieldRow>
          )}
        </div>
      </SectionCard>

      {/* Reset */}
      <SectionCard
        title={t('额度重置')}
        description={t('支持周期性重置套餐权益额度')}
      >
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
          <FieldRow label={t('重置周期')}>
            <NativeSelect
              value={values.quota_reset_period}
              onChange={(v) => set('quota_reset_period', v)}
              options={resetPeriodOptions(t)}
            />
          </FieldRow>
          <FieldRow label={t('自定义秒数')}>
            <NumberField
              value={values.quota_reset_custom_seconds}
              onChange={(v) => set('quota_reset_custom_seconds', Math.floor(v))}
              min={values.quota_reset_period === 'custom' ? 60 : 0}
              disabled={values.quota_reset_period !== 'custom'}
            />
          </FieldRow>
        </div>
      </SectionCard>
    </SlideOver>
  );
};

export default AddEditSubscriptionModal;

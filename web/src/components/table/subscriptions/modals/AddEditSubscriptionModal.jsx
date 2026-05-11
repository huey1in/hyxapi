/*
 * Add / edit subscription plan — SlideOver with SectionCard layout.
 * 新方案：删除价格/币种/购买上限/支付ID等销售字段，加入 AllowedGroups / AllowedModels / ConcurrentLimit / RPMLimit 限制字段。
 */
import React, { useEffect, useState } from 'react';
import { API, showError, showSuccess } from '../../../../helpers';
import {
  quotaToDisplayAmount,
  displayAmountToQuota,
} from '../../../../helpers/quota';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import SlideOver from '../../../common/SlideOver';
import { Button, Card } from '../../../ui';
import {
  TextField,
  NumberField,
  NativeSelect,
  ToggleField,
  FieldRow,
  TagInput,
  MultiCombobox,
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
  duration_unit: 'month',
  duration_value: 1,
  custom_seconds: 0,
  quota_reset_period: 'never',
  quota_reset_custom_seconds: 0,
  enabled: true,
  sort_order: 0,
  total_amount: 0,
  // 新方案：访问限制
  allowed_groups: [],
  allowed_models: [],
  concurrent_limit: 0,
  rpm_limit: 0,
};

const SectionCard = ({ title, description, children }) => (
  <Card>
    <div className='mb-4'>
      <div className='text-sm font-semibold text-ui-text'>{title}</div>
      {description && <div className='text-[11px] text-ui-text-3 mt-0.5'>{description}</div>}
    </div>
    <div className='space-y-3'>{children}</div>
  </Card>
);

const parseListField = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

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
      duration_unit: p.duration_unit || 'month',
      duration_value: Number(p.duration_value || 1),
      custom_seconds: Number(p.custom_seconds || 0),
      quota_reset_period: p.quota_reset_period || 'never',
      quota_reset_custom_seconds: Number(p.quota_reset_custom_seconds || 0),
      enabled: p.enabled !== false,
      sort_order: Number(p.sort_order || 0),
      total_amount: Number(quotaToDisplayAmount(p.total_amount || 0).toFixed(2)),
      allowed_groups: parseListField(p.allowed_groups),
      allowed_models: parseListField(p.allowed_models),
      concurrent_limit: Number(p.concurrent_limit || 0),
      rpm_limit: Number(p.rpm_limit || 0),
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
          duration_value: Number(values.duration_value || 0),
          custom_seconds: Number(values.custom_seconds || 0),
          quota_reset_period: values.quota_reset_period || 'never',
          quota_reset_custom_seconds:
            values.quota_reset_period === 'custom'
              ? Number(values.quota_reset_custom_seconds || 0)
              : 0,
          sort_order: Number(values.sort_order || 0),
          total_amount: displayAmountToQuota(values.total_amount),
          allowed_groups: JSON.stringify(values.allowed_groups || []),
          allowed_models: JSON.stringify(values.allowed_models || []),
          concurrent_limit: Number(values.concurrent_limit || 0),
          rpm_limit: Number(values.rpm_limit || 0),
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
          <Button variant='secondary' onClick={handleClose}>
            {t('取消')}
          </Button>
          <Button onClick={submit} loading={loading}>
            {loading ? t('提交中...') : isEdit ? t('保存') : t('创建')}
          </Button>
        </>
      }
      bodyClass='p-5 space-y-4'
    >
      {/* Basic info */}
      <SectionCard
        title={t('基本信息')}
        description={t('套餐的标题、副标题与展示顺序')}
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
        <FieldRow label={t('排序')}>
          <NumberField
            value={values.sort_order}
            onChange={(v) => set('sort_order', Math.floor(v))}
          />
        </FieldRow>
        <div className='pt-1'>
          <ToggleField
            label={t('启用状态')}
            checked={!!values.enabled}
            onChange={(v) => set('enabled', v)}
          />
        </div>
      </SectionCard>

      {/* Quota */}
      <SectionCard
        title={t('额度')}
        description={t('订阅期间分配给用户的可用额度（在订阅允许的分组内消耗）')}
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
      </SectionCard>

      {/* Access limits */}
      <SectionCard
        title={t('访问限制')}
        description={t('限定订阅可使用的模型分组、模型名、并发与 RPM')}
      >
        <FieldRow
          label={t('允许的模型分组')}
          hint={t('为空表示不限制。可多选 channel 分组。')}
        >
          <MultiCombobox
            value={values.allowed_groups}
            onChange={(v) => set('allowed_groups', v)}
            disabled={groupLoading}
            options={(groupOptions || []).map((g) => ({ value: g, label: g }))}
            placeholder={t('选择允许的分组')}
          />
        </FieldRow>
        <FieldRow
          label={t('允许的模型')}
          hint={t('为空表示不限制。输入模型名后回车添加；逗号或换行分隔可批量添加。')}
        >
          <TagInput
            value={values.allowed_models}
            onChange={(v) => set('allowed_models', v)}
            placeholder={t('如：gpt-4o,claude-3-5-sonnet')}
          />
        </FieldRow>
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
          <FieldRow label={t('并发限制')} hint={t('0 表示不限')}>
            <NumberField
              value={values.concurrent_limit}
              onChange={(v) => set('concurrent_limit', Math.max(0, Math.floor(v)))}
              min={0}
            />
          </FieldRow>
          <FieldRow label={t('RPM 限制')} hint={t('每分钟请求数，0 表示不限')}>
            <NumberField
              value={values.rpm_limit}
              onChange={(v) => set('rpm_limit', Math.max(0, Math.floor(v)))}
              min={0}
            />
          </FieldRow>
        </div>
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

/*
 * Quota redemption code editor — token-system rewrite (SlideOver + primitives).
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CreditCard, Gift } from 'lucide-react';
import {
  API,
  downloadTextAsFile,
  showError,
  showSuccess,
  renderQuota,
  getCurrencyConfig,
} from '../../../../helpers';
import {
  quotaToDisplayAmount,
  displayAmountToQuota,
} from '../../../../helpers/quota';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import SlideOver from '../../../common/SlideOver';
import { showConfirm } from '../../../common/ConfirmDialog';
import {
  TextField,
  NumberField,
  FieldRow,
} from '../../../common/form/Primitives';

const SectionHeader = ({ icon: Icon, title, hint, color = 'blue' }) => {
  const cls = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  }[color];
  return (
    <div className='flex items-center gap-2 mb-3'>
      <div className={`w-8 h-8 rounded-md inline-flex items-center justify-center border ${cls}`}>
        <Icon size={15} />
      </div>
      <div>
        <div className='text-sm font-semibold text-ui-text'>{title}</div>
        {hint && <div className='text-[11px] text-ui-text-3'>{hint}</div>}
      </div>
    </div>
  );
};

const DEFAULTS = () => ({
  name: '',
  quota: 100000,
  amount: Number(quotaToDisplayAmount(100000).toFixed(6)),
  count: 1,
  expired_time: '', // ISO string for datetime-local input
});

const EditRedemptionModal = (props) => {
  const { t } = useTranslation();
  const isEdit = props.editingRedemption?.id !== undefined;
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [showQuotaInput, setShowQuotaInput] = useState(false);
  const [values, setValues] = useState(DEFAULTS());

  const set = (k, v) => setValues((p) => ({ ...p, [k]: v }));

  const loadRedemption = async () => {
    setLoading(true);
    try {
      const res = await API.get(`/api/redemption/${props.editingRedemption.id}`);
      const { success, message, data } = res.data;
      if (success) {
        const expired_time =
          data.expired_time === 0
            ? ''
            : new Date(data.expired_time * 1000).toISOString().slice(0, 16);
        setValues({
          ...DEFAULTS(),
          name: data.name || '',
          quota: data.quota || 0,
          amount: Number(quotaToDisplayAmount(data.quota || 0).toFixed(6)),
          count: 1,
          expired_time,
        });
      } else {
        showError(message);
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!props.visiable) return;
    if (isEdit) {
      loadRedemption();
    } else {
      setValues(DEFAULTS());
    }
  }, [props.visiable, props.editingRedemption?.id]); // eslint-disable-line

  const onAmountChange = (v) => {
    const a = v == null || v === '' ? 0 : v;
    setValues((p) => ({
      ...p,
      amount: a,
      quota: displayAmountToQuota(a),
    }));
  };

  const onQuotaChange = (v) => {
    const q = v == null || v === '' ? 0 : v;
    setValues((p) => ({
      ...p,
      quota: q,
      amount: Number(quotaToDisplayAmount(q).toFixed(6)),
    }));
  };

  const submit = async () => {
    let name = values.name;
    if (!isEdit && !name) name = renderQuota(values.quota);
    if (!values.quota || values.quota <= 0) {
      showError(t('请输入金额'));
      return;
    }
    setLoading(true);
    const body = {
      ...values,
      name,
      count: parseInt(values.count) || 1,
      quota: displayAmountToQuota(values.amount),
      expired_time: values.expired_time
        ? Math.floor(new Date(values.expired_time).getTime() / 1000)
        : 0,
    };
    try {
      const res = isEdit
        ? await API.put('/api/redemption/', { ...body, id: parseInt(props.editingRedemption.id) })
        : await API.post('/api/redemption/', body);
      const { success, message, data } = res.data;
      if (success) {
        showSuccess(isEdit ? t('兑换码更新成功！') : t('兑换码创建成功！'));
        props.refresh();
        props.handleClose();
        if (!isEdit && data) {
          const text = data.join('\n');
          showConfirm({
            title: t('兑换码创建成功'),
            content: t('是否下载为文本文件？'),
            okText: t('下载'),
            cancelText: t('取消'),
            onOk: () => downloadTextAsFile(text, `${body.name}.txt`),
          });
        }
      } else {
        showError(message);
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SlideOver
      open={!!props.visiable}
      onClose={props.handleClose}
      placement={isEdit ? 'right' : 'left'}
      width={isMobile ? window.innerWidth : 600}
      title={
        <>
          <span
            className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-md border ${
              isEdit
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
            }`}
          >
            {isEdit ? t('更新') : t('新建')}
          </span>
          <span className='text-base font-semibold text-ui-text truncate'>
            {isEdit ? t('更新兑换码信息') : t('创建新的兑换码')}
          </span>
        </>
      }
      footer={
        <>
          <button
            onClick={props.handleClose}
            className='inline-flex items-center px-3.5 py-1.5 text-xs font-medium rounded-md border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle whitespace-nowrap'
          >
            {t('取消')}
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className='inline-flex items-center px-4 py-1.5 text-xs font-semibold rounded-md bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover disabled:opacity-50 whitespace-nowrap'
          >
            {loading ? t('提交中...') : t('提交')}
          </button>
        </>
      }
      bodyClass='p-5 space-y-6'
    >
      {/* Basic info */}
      <div>
        <SectionHeader
          icon={Gift}
          title={t('基本信息')}
          hint={t('设置兑换码的基本信息')}
          color='blue'
        />
        <div className='space-y-3'>
          <FieldRow label={t('名称')} required={isEdit}>
            <TextField
              value={values.name}
              onChange={(v) => set('name', v)}
              placeholder={t('请输入名称（留空时自动以额度命名）')}
            />
          </FieldRow>
          <FieldRow label={t('过期时间')} hint={t('留空表示永不过期')}>
            <input
              type='datetime-local'
              value={values.expired_time}
              onChange={(e) => set('expired_time', e.target.value)}
              className='w-full px-3 py-2 text-sm bg-ui-bg border border-ui-border rounded-md text-ui-text outline-none focus:border-ui-text-3'
            />
          </FieldRow>
        </div>
      </div>

      {/* Quota */}
      <div>
        <SectionHeader
          icon={CreditCard}
          title={t('额度设置')}
          hint={t('设置兑换码的额度和数量')}
          color='green'
        />
        <div className='space-y-3'>
          <FieldRow label={t('金额')}>
            <TextField
              value={values.amount}
              type='number'
              step='0.000001'
              min='0'
              onChange={(v) => onAmountChange(parseFloat(v) || 0)}
              prefix={
                <span className='text-ui-text-3 text-xs'>{getCurrencyConfig().symbol}</span>
              }
            />
          </FieldRow>
          <button
            type='button'
            onClick={() => setShowQuotaInput((v) => !v)}
            className='text-[11px] text-ui-text-3 hover:text-ui-text'
          >
            {showQuotaInput ? `▾ ${t('收起原生额度输入')}` : `▸ ${t('使用原生额度输入')}`}
          </button>
          {showQuotaInput && (
            <FieldRow label={t('额度')}>
              <NumberField
                value={values.quota}
                onChange={onQuotaChange}
                min={1}
              />
            </FieldRow>
          )}
          {!isEdit && (
            <FieldRow label={t('生成数量')}>
              <NumberField
                value={values.count}
                onChange={(v) => set('count', Math.max(1, Math.floor(v)))}
                min={1}
              />
            </FieldRow>
          )}
        </div>
      </div>
    </SlideOver>
  );
};

export default EditRedemptionModal;

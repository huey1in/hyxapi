/*
 * Edit user — token-system rewrite (SlideOver + primitives + adjust quota
 * portal). Drops the third-party social ID fields (rarely used after the
 * Stripe/Creem payment flow was removed).
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { User, Users, Edit3, X, Loader2 } from 'lucide-react';
import {
  API,
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
  username: '',
  display_name: '',
  password: '',
  email: '',
  quota: 0,
  remark: '',
});

const EditUserModal = (props) => {
  const { t } = useTranslation();
  const userId = props.editingUser?.id;
  const isEdit = Boolean(userId);
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState(DEFAULTS());
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustMode, setAdjustMode] = useState('add');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);

  const set = (k, v) => setValues((p) => ({ ...p, [k]: v }));

  const loadUser = async () => {
    setLoading(true);
    try {
      const url = userId ? `/api/user/${userId}` : '/api/user/self';
      const { data } = await API.get(url);
      if (data.success) {
        setValues({
          ...DEFAULTS(),
          ...data.data,
          password: '',
          quota: data.data.quota || 0,
        });
      } else {
        showError(data.message);
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!props.visible) return;
    if (userId !== undefined) loadUser();
    else setValues(DEFAULTS());
  }, [props.visible, userId]); // eslint-disable-line

  const submit = async () => {
    if (!values.username) return showError(t('请输入用户名'));
    setLoading(true);
    try {
      const payload = { ...values };
      delete payload.quota;
      delete payload.used_quota;
      delete payload.aff_count;
      delete payload.aff_history_quota;
      if (userId) payload.id = parseInt(userId);
      const url = userId ? '/api/user/' : '/api/user/self';
      const { data } = await API.put(url, payload);
      if (data.success) {
        showSuccess(t('用户信息更新成功！'));
        props.refresh();
        props.handleClose();
      } else {
        showError(data.message);
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Adjust-quota modal state
  const adjustQuotaValue = parseFloat(adjustAmount || 0) || 0;
  const adjustQuotaInQuota =
    adjustMode === 'override'
      ? displayAmountToQuota(adjustQuotaValue)
      : displayAmountToQuota(Math.abs(adjustQuotaValue));

  const previewText = () => {
    const cur = values.quota || 0;
    if (adjustMode === 'add') return `${renderQuota(cur)} + ${renderQuota(adjustQuotaInQuota)} = ${renderQuota(cur + adjustQuotaInQuota)}`;
    if (adjustMode === 'subtract') return `${renderQuota(cur)} − ${renderQuota(adjustQuotaInQuota)} = ${renderQuota(cur - adjustQuotaInQuota)}`;
    return `${renderQuota(cur)} → ${renderQuota(adjustQuotaInQuota)}`;
  };

  const submitAdjust = async () => {
    if (!adjustAmount && adjustMode !== 'override') return showError(t('请输入金额'));
    setAdjustLoading(true);
    try {
      const { data } = await API.post('/api/user/manage', {
        id: parseInt(userId),
        action: 'add_quota',
        mode: adjustMode,
        value:
          adjustMode === 'override'
            ? adjustQuotaInQuota
            : Math.abs(adjustQuotaInQuota),
      });
      if (data.success) {
        showSuccess(t('调整额度成功'));
        setAdjustOpen(false);
        setAdjustAmount('');
        await loadUser();
        props.refresh();
      } else {
        showError(data.message);
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setAdjustLoading(false);
    }
  };

  return (
    <>
      <SlideOver
        open={!!props.visible}
        onClose={props.handleClose}
        placement='right'
        width={isMobile ? window.innerWidth : 600}
        title={
          <>
            <span className='inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'>
              {isEdit ? t('编辑') : t('新建')}
            </span>
            <span className='text-base font-semibold text-ui-text truncate'>
              {isEdit ? t('编辑用户') : t('创建用户')}
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
        {loading ? (
          <div className='py-12 text-center text-ui-text-3 text-sm flex items-center justify-center gap-2'>
            <Loader2 size={14} className='animate-spin' />
            {t('加载中...')}
          </div>
        ) : (
          <>
            {/* Basic info */}
            <div>
              <SectionHeader
                icon={User}
                title={t('基本信息')}
                hint={t('用户的基本账户信息')}
                color='blue'
              />
              <div className='space-y-3'>
                <FieldRow label={t('用户名')} required>
                  <TextField
                    value={values.username}
                    onChange={(v) => set('username', v)}
                    placeholder={t('请输入用户名')}
                  />
                </FieldRow>
                <FieldRow label={t('密码')} hint={isEdit ? t('留空保持不变') : undefined}>
                  <TextField
                    type='password'
                    value={values.password}
                    onChange={(v) => set('password', v)}
                    placeholder={t('请输入新的密码，最短 8 位')}
                    autoComplete='new-password'
                  />
                </FieldRow>
                <FieldRow label={t('显示名称')}>
                  <TextField
                    value={values.display_name}
                    onChange={(v) => set('display_name', v)}
                    placeholder={t('请输入显示名称')}
                  />
                </FieldRow>
                <FieldRow label={t('邮箱')}>
                  <TextField
                    type='email'
                    value={values.email}
                    onChange={(v) => set('email', v)}
                    placeholder='you@example.com'
                  />
                </FieldRow>
                <FieldRow label={t('备注')} hint={t('仅管理员可见')}>
                  <TextField
                    value={values.remark}
                    onChange={(v) => set('remark', v)}
                    placeholder={t('请输入备注')}
                  />
                </FieldRow>
              </div>
            </div>

            {/* Quota */}
            {isEdit && (
              <div>
                <SectionHeader
                  icon={Users}
                  title={t('权限设置')}
                  hint={t('用户额度管理')}
                  color='green'
                />
                <div className='space-y-3'>
                  <FieldRow label={t('当前额度')}>
                    <div className='flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-ui-border bg-ui-bg-subtle'>
                      <span className='text-sm text-ui-text tabular-nums'>
                        {renderQuota(values.quota || 0)}
                        <span className='ml-2 text-xs text-ui-text-3'>
                          {getCurrencyConfig().symbol}
                          {Number(quotaToDisplayAmount(values.quota || 0).toFixed(6))}
                        </span>
                      </span>
                      <button
                        type='button'
                        onClick={() => {
                          setAdjustMode('add');
                          setAdjustAmount('');
                          setAdjustOpen(true);
                        }}
                        className='inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg whitespace-nowrap'
                      >
                        <Edit3 size={11} />
                        {t('调整额度')}
                      </button>
                    </div>
                  </FieldRow>
                </div>
              </div>
            )}
          </>
        )}
      </SlideOver>

      {/* Adjust quota inner modal */}
      {adjustOpen &&
        createPortal(
          <div
            className='fixed inset-0 z-[130] flex items-center justify-center p-4'
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={adjustLoading ? undefined : () => setAdjustOpen(false)}
          >
            <div
              className='bg-ui-bg-elevated border border-ui-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='flex items-center justify-between gap-3 px-5 py-3.5 border-b border-ui-border'>
                <span className='flex items-center gap-2 text-sm font-semibold text-ui-text'>
                  <Edit3 size={14} />
                  {t('调整额度')}
                </span>
                <button
                  onClick={() => setAdjustOpen(false)}
                  disabled={adjustLoading}
                  className='p-1 rounded text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle disabled:opacity-40'
                >
                  <X size={16} />
                </button>
              </div>
              <div className='p-5 space-y-3'>
                <p className='text-xs text-ui-text-3'>{previewText()}</p>
                <FieldRow label={t('操作')}>
                  <div className='flex items-center gap-1'>
                    {[
                      { v: 'add', l: t('添加') },
                      { v: 'subtract', l: t('减少') },
                      { v: 'override', l: t('覆盖') },
                    ].map((m) => (
                      <button
                        key={m.v}
                        onClick={() => {
                          setAdjustMode(m.v);
                          setAdjustAmount('');
                        }}
                        className={`flex-1 px-2.5 py-1.5 text-xs rounded-md transition-colors ${
                          adjustMode === m.v
                            ? 'bg-ui-bg-subtle text-ui-text font-semibold border border-ui-text-3'
                            : 'border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle'
                        }`}
                      >
                        {m.l}
                      </button>
                    ))}
                  </div>
                </FieldRow>
                <FieldRow label={t('金额')}>
                  <TextField
                    type='number'
                    step='0.000001'
                    value={adjustAmount}
                    onChange={(v) => setAdjustAmount(v)}
                    placeholder={t('输入金额')}
                    prefix={
                      <span className='text-ui-text-3 text-xs'>{getCurrencyConfig().symbol}</span>
                    }
                  />
                </FieldRow>
              </div>
              <div className='flex justify-end gap-2 px-5 py-3 border-t border-ui-border'>
                <button
                  onClick={() => setAdjustOpen(false)}
                  disabled={adjustLoading}
                  className='inline-flex items-center px-3.5 py-1.5 text-xs font-medium rounded-md border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle disabled:opacity-40 whitespace-nowrap'
                >
                  {t('取消')}
                </button>
                <button
                  onClick={submitAdjust}
                  disabled={adjustLoading}
                  className='inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover disabled:opacity-50 whitespace-nowrap'
                >
                  {adjustLoading && <Loader2 size={11} className='animate-spin' />}
                  {t('确认调整')}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

export default EditUserModal;

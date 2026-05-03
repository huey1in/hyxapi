/*
 * Add user — token-system rewrite (SlideOver + primitives).
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserPlus } from 'lucide-react';
import { API, showError, showSuccess } from '../../../../helpers';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import SlideOver from '../../../common/SlideOver';
import { TextField, FieldRow } from '../../../common/form/Primitives';

const SectionHeader = ({ icon: Icon, title, hint, color = 'blue' }) => {
  const cls = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
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

const AddUserModal = (props) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState({
    username: '',
    display_name: '',
    password: '',
    remark: '',
  });

  useEffect(() => {
    if (props.visible) {
      setValues({ username: '', display_name: '', password: '', remark: '' });
    }
  }, [props.visible]);

  const set = (k, v) => setValues((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!values.username) return showError(t('请输入用户名'));
    if (!values.password) return showError(t('请输入密码'));
    setLoading(true);
    try {
      const { data } = await API.post('/api/user/', values);
      if (data.success) {
        showSuccess(t('用户账户创建成功！'));
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

  return (
    <SlideOver
      open={!!props.visible}
      onClose={props.handleClose}
      placement='left'
      width={isMobile ? window.innerWidth : 600}
      title={
        <>
          <span className='inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'>
            {t('新建')}
          </span>
          <span className='text-base font-semibold text-ui-text truncate'>{t('添加用户')}</span>
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
      bodyClass='p-5'
    >
      <SectionHeader icon={UserPlus} title={t('用户信息')} hint={t('创建新用户账户')} />
      <div className='space-y-3'>
        <FieldRow label={t('用户名')} required>
          <TextField
            value={values.username}
            onChange={(v) => set('username', v)}
            placeholder={t('请输入用户名')}
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
        <FieldRow label={t('密码')} required>
          <TextField
            type='password'
            value={values.password}
            onChange={(v) => set('password', v)}
            placeholder={t('请输入密码')}
            autoComplete='new-password'
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
    </SlideOver>
  );
};

export default AddUserModal;

/*
 * AddUserModal — 与 web-backup 同构。
 *
 * SlideOver (left) + 表单 + 底部按钮。
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../../../helpers';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import { Button, Card, Input, FieldRow, SlideOver } from '../../../ui';

const AddUserModal = (props) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState({ username: '', display_name: '', password: '', remark: '' });

  useEffect(() => {
    if (props.visible) setValues({ username: '', display_name: '', password: '', remark: '' });
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
      } else showError(data.message);
    } catch (e) { showError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <SlideOver
      open={!!props.visible}
      onClose={props.handleClose}
      placement='left'
      width={isMobile ? window.innerWidth : 600}
      title={
        <>
          <span className='inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'>
            {t('新建')}
          </span>
          <span className='text-base font-semibold text-ui-text truncate'>{t('添加用户')}</span>
        </>
      }
      footer={
        <>
          <Button variant='toggle' onClick={props.handleClose}>{t('取消')}</Button>
          <Button onClick={submit} disabled={loading}>{loading ? t('提交中...') : t('创建')}</Button>
        </>
      }
    >
      <div className='p-5'>
        <Card>
          <div className='mb-3'>
            <div className='text-sm font-semibold text-ui-text'>{t('用户信息')}</div>
            <div className='text-[11px] text-ui-text-3 mt-0.5'>{t('创建新用户账户')}</div>
          </div>
          <div className='space-y-3'>
            <FieldRow label={t('用户名')} required>
              <Input value={values.username} onChange={(v) => set('username', v)} placeholder={t('请输入用户名')} autoComplete='new-password' />
            </FieldRow>
            <FieldRow label={t('显示名称')}>
              <Input value={values.display_name} onChange={(v) => set('display_name', v)} placeholder={t('请输入显示名称')} />
            </FieldRow>
            <FieldRow label={t('密码')} required>
              <Input type='password' value={values.password} onChange={(v) => set('password', v)} placeholder={t('请输入密码')} autoComplete='new-password' />
            </FieldRow>
            <FieldRow label={t('备注')} hint={t('仅管理员可见')}>
              <Input value={values.remark} onChange={(v) => set('remark', v)} placeholder={t('请输入备注')} />
            </FieldRow>
          </div>
        </Card>
      </div>
    </SlideOver>
  );
};

export default AddUserModal;

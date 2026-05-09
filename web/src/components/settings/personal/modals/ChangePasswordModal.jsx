/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React from 'react';
import { Lock } from 'lucide-react';
import ModalDialog from '../../../common/ModalDialog';
import { TextField, FieldRow } from '../../../common/form/Primitives';
import Turnstile from 'react-turnstile';

const ChangePasswordModal = ({
  t,
  showChangePasswordModal,
  setShowChangePasswordModal,
  inputs,
  handleInputChange,
  changePassword,
  turnstileEnabled,
  turnstileSiteKey,
  setTurnstileToken,
}) => {
  return (
    <ModalDialog
      open={showChangePasswordModal}
      onClose={() => setShowChangePasswordModal(false)}
      title={
        <div className='flex items-center'>
          <Lock size={16} className='mr-2 text-orange-500' />
          {t('修改密码')}
        </div>
      }
      footer={
        <>
          <button
            onClick={() => setShowChangePasswordModal(false)}
            className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors'
          >
            {t('取消')}
          </button>
          <button
            onClick={changePassword}
            className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover transition-colors disabled:opacity-50'
          >
            {t('确定')}
          </button>
        </>
      }
    >
      <div className='space-y-4'>
        <FieldRow label={t('原密码')}>
          <TextField
            name='original_password'
            placeholder={t('请输入原密码')}
            type='password'
            value={inputs.original_password}
            onChange={(value) => handleInputChange('original_password', value)}
            prefix={<Lock size={14} />}
          />
        </FieldRow>

        <FieldRow label={t('新密码')}>
          <TextField
            name='set_new_password'
            placeholder={t('请输入新密码')}
            type='password'
            value={inputs.set_new_password}
            onChange={(value) => handleInputChange('set_new_password', value)}
            prefix={<Lock size={14} />}
          />
        </FieldRow>

        <FieldRow label={t('确认新密码')}>
          <TextField
            name='set_new_password_confirmation'
            placeholder={t('请再次输入新密码')}
            type='password'
            value={inputs.set_new_password_confirmation}
            onChange={(value) =>
              handleInputChange('set_new_password_confirmation', value)
            }
            prefix={<Lock size={14} />}
          />
        </FieldRow>

        {turnstileEnabled && (
          <div className='flex justify-center'>
            <Turnstile
              sitekey={turnstileSiteKey}
              onVerify={(token) => {
                setTurnstileToken(token);
              }}
            />
          </div>
        )}
      </div>
    </ModalDialog>
  );
};

export default ChangePasswordModal;

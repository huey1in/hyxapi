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
import { Mail, Key } from 'lucide-react';
import ModalDialog from '../../../common/ModalDialog';
import { TextField } from '../../../common/form/Primitives';
import Turnstile from 'react-turnstile';

const EmailBindModal = ({
  t,
  showEmailBindModal,
  setShowEmailBindModal,
  inputs,
  handleInputChange,
  sendVerificationCode,
  bindEmail,
  disableButton,
  loading,
  countdown,
  turnstileEnabled,
  turnstileSiteKey,
  setTurnstileToken,
}) => {
  return (
    <ModalDialog
      open={showEmailBindModal}
      onClose={() => setShowEmailBindModal(false)}
      title={
        <div className='flex items-center'>
          <Mail size={16} className='mr-2 text-blue-500' />
          {t('绑定邮箱地址')}
        </div>
      }
      footer={
        <>
          <button
            onClick={() => setShowEmailBindModal(false)}
            className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors'
          >
            {t('取消')}
          </button>
          <button
            onClick={bindEmail}
            className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover transition-colors disabled:opacity-50'
          >
            {t('确定')}
          </button>
        </>
      }
    >
      <div className='space-y-4'>
        <div className='flex gap-3'>
          <div className='flex-1'>
            <TextField
              placeholder={t('输入邮箱地址')}
              onChange={(value) => handleInputChange('email', value)}
              name='email'
              type='email'
              prefix={<Mail size={14} />}
            />
          </div>
          <button
            onClick={sendVerificationCode}
            disabled={disableButton || loading}
            className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors disabled:opacity-50 whitespace-nowrap'
          >
            {disableButton
              ? `${t('重新发送')} (${countdown})`
              : t('获取验证码')}
          </button>
        </div>

        <TextField
          placeholder={t('验证码')}
          name='email_verification_code'
          value={inputs.email_verification_code}
          onChange={(value) =>
            handleInputChange('email_verification_code', value)
          }
          prefix={<Key size={14} />}
        />

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

export default EmailBindModal;

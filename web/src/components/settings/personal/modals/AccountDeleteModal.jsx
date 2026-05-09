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
import { Trash2, User } from 'lucide-react';
import ModalDialog from '../../../common/ModalDialog';
import { TextField, FieldRow, Notice } from '../../../common/form/Primitives';
import Turnstile from 'react-turnstile';

const AccountDeleteModal = ({
  t,
  showAccountDeleteModal,
  setShowAccountDeleteModal,
  inputs,
  handleInputChange,
  deleteAccount,
  userState,
  turnstileEnabled,
  turnstileSiteKey,
  setTurnstileToken,
}) => {
  return (
    <ModalDialog
      open={showAccountDeleteModal}
      onClose={() => setShowAccountDeleteModal(false)}
      title={
        <div className='flex items-center'>
          <Trash2 size={16} className='mr-2 text-red-500' />
          {t('删除账户确认')}
        </div>
      }
      footer={
        <>
          <button
            onClick={() => setShowAccountDeleteModal(false)}
            className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors'
          >
            {t('取消')}
          </button>
          <button
            onClick={deleteAccount}
            className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-ui-danger text-white hover:opacity-90 transition-opacity disabled:opacity-50'
          >
            {t('确定')}
          </button>
        </>
      }
    >
      <div className='space-y-4'>
        <Notice kind='danger'>
          {t('您正在删除自己的帐户，将清空所有数据且不可恢复')}
        </Notice>

        <FieldRow label={<span className='text-red-600'>{t('请输入您的用户名以确认删除')}</span>}>
          <TextField
            placeholder={t('输入你的账户名{{username}}以确认删除', {
              username: ` ${userState?.user?.username} `,
            })}
            name='self_account_deletion_confirmation'
            value={inputs.self_account_deletion_confirmation}
            onChange={(value) =>
              handleInputChange('self_account_deletion_confirmation', value)
            }
            prefix={<User size={14} />}
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

export default AccountDeleteModal;

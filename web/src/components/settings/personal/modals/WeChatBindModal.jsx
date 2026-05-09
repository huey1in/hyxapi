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
import { Key } from 'lucide-react';
import { SiWechat } from 'react-icons/si';
import ModalDialog from '../../../common/ModalDialog';
import { TextField } from '../../../common/form/Primitives';

const WeChatBindModal = ({
  t,
  showWeChatBindModal,
  setShowWeChatBindModal,
  inputs,
  handleInputChange,
  bindWeChat,
  status,
}) => {
  return (
    <ModalDialog
      open={showWeChatBindModal}
      onClose={() => setShowWeChatBindModal(false)}
      title={
        <div className='flex items-center'>
          <SiWechat className='mr-2 text-green-500' />
          {t('绑定微信账户')}
        </div>
      }
      hideFooter
    >
      <div className='space-y-4 text-center'>
        <img src={status.wechat_qrcode} className='mx-auto' alt='WeChat QR Code' />
        <div className='text-ui-text-2'>
          <p>
            {t('微信扫码关注公众号，输入「验证码」获取验证码（三分钟内有效）')}
          </p>
        </div>
        <TextField
          placeholder={t('验证码')}
          name='wechat_verification_code'
          value={inputs.wechat_verification_code}
          onChange={(v) => handleInputChange('wechat_verification_code', v)}
          prefix={<Key size={14} />}
        />
        <button
          onClick={bindWeChat}
          className='inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover transition-colors disabled:opacity-50 w-full'
        >
          {t('绑定')}
        </button>
      </div>
    </ModalDialog>
  );
};

export default WeChatBindModal;

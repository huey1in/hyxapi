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

import React, { useEffect, useState } from 'react';
import { API, copy, showError, showNotice } from '../../helpers';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const inputClass =
  'w-full px-4 py-3 text-sm border border-ui-border rounded-lg outline-none focus:ring-2 focus:ring-ui-accent bg-ui-bg text-ui-text placeholder:text-ui-text-3 disabled:bg-ui-bg-subtle disabled:text-ui-text-3';

const PasswordResetConfirm = () => {
  const { t } = useTranslation();
  const [inputs, setInputs] = useState({ email: '', token: '' });
  const { email, token } = inputs;
  const isValidResetLink = email && token;

  const [loading, setLoading] = useState(false);
  const [disableButton, setDisableButton] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [newPassword, setNewPassword] = useState('');
  const [searchParams] = useSearchParams();

  useEffect(() => {
    setInputs({
      token: searchParams.get('token') || '',
      email: searchParams.get('email') || '',
    });
  }, [searchParams]);

  useEffect(() => {
    let countdownInterval = null;
    if (disableButton && countdown > 0) {
      countdownInterval = setInterval(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else if (countdown === 0) {
      setDisableButton(false);
      setCountdown(30);
    }
    return () => clearInterval(countdownInterval);
  }, [disableButton, countdown]);

  async function handleSubmit() {
    if (!email || !token) {
      showError(t('无效的重置链接，请重新发起密码重置请求'));
      return;
    }
    setDisableButton(true);
    setLoading(true);
    const res = await API.post(`/api/user/reset`, { email, token });
    const { success, message } = res.data;
    if (success) {
      const password = res.data.data;
      setNewPassword(password);
      await copy(password);
      showNotice(`${t('密码已重置并已复制到剪贴板：')} ${password}`);
    } else {
      showError(message);
    }
    setLoading(false);
  }

  return (
    <div className='min-h-screen flex items-start sm:items-center justify-center px-0 sm:px-4 pt-24 pb-12'>
      <div className='w-full max-w-sm sm:mt-[60px]'>
        <div className='p-6 sm:bg-ui-bg-elevated sm:rounded-2xl sm:border sm:border-ui-border sm:p-8'>
          <h2 className='text-2xl font-semibold text-ui-text mb-6'>
            {t('密码重置确认')}
          </h2>

          <div className='space-y-4'>
            {!isValidResetLink && (
              <div className='px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700'>
                {t('无效的重置链接，请重新发起密码重置请求')}
              </div>
            )}

            <div>
              <label className='block mb-2 text-sm font-medium text-ui-text'>
                {t('邮箱')}
              </label>
              <input
                type='email'
                value={email}
                disabled
                placeholder={t('等待获取邮箱信息...')}
                className={inputClass}
              />
            </div>

            {newPassword && (
              <div>
                <label className='block mb-2 text-sm font-medium text-ui-text'>
                  {t('新密码')}
                </label>
                <div className='flex gap-2'>
                  <input
                    type='text'
                    value={newPassword}
                    disabled
                    className={inputClass + ' flex-1'}
                  />
                  <button
                    onClick={async () => {
                      await copy(newPassword);
                      showNotice(`${t('密码已复制到剪贴板：')} ${newPassword}`);
                    }}
                    className='px-4 py-3 text-sm font-medium border border-black rounded-lg hover:bg-ui-bg-subtle transition-colors whitespace-nowrap'
                  >
                    {t('复制')}
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || disableButton || !!newPassword || !isValidResetLink}
              className='w-full py-3 text-sm font-medium rounded-lg transition-colors bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
            >
              {loading && (
                <span className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />
              )}
              {newPassword ? t('密码重置完成') : t('确认重置密码')}
            </button>
          </div>

          <p className='mt-6 text-center text-sm text-ui-text-2'>
            <Link to='/login' className='text-ui-text font-medium underline'>
              {t('返回登录')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PasswordResetConfirm;

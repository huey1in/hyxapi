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
import { API, showError, showInfo, showSuccess } from '../../helpers';
import Turnstile from 'react-turnstile';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const inputClass =
  'w-full px-4 py-3 text-sm border border-ui-border rounded-lg outline-none focus:ring-2 focus:ring-ui-accent bg-transparent text-ui-text placeholder:text-ui-text-3';

const PasswordResetForm = ({ embedded = false, onSwitchToLogin }) => {
  const { t } = useTranslation();
  const [inputs, setInputs] = useState({ email: '' });
  const { email } = inputs;

  const [loading, setLoading] = useState(false);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [disableButton, setDisableButton] = useState(false);
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    let status = localStorage.getItem('status');
    if (status) {
      status = JSON.parse(status);
      if (status.turnstile_check) {
        setTurnstileEnabled(true);
        setTurnstileSiteKey(status.turnstile_site_key);
      }
    }
  }, []);

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
    if (!email) {
      showError(t('请输入邮箱地址'));
      return;
    }
    if (turnstileEnabled && turnstileToken === '') {
      showInfo(t('请稍后几秒重试，Turnstile 正在检查用户环境！'));
      return;
    }
    setDisableButton(true);
    setLoading(true);
    const res = await API.get(
      `/api/reset_password?email=${email}&turnstile=${turnstileToken}`,
    );
    const { success, message } = res.data;
    if (success) {
      showSuccess(t('重置邮件发送成功，请检查邮箱！'));
      setInputs({ email: '' });
    } else {
      showError(message);
    }
    setLoading(false);
  }

  const formContent = (
    <>
      <div className='mb-6'>
        <h2 className='text-xl font-semibold text-ui-text'>{t('密码重置')}</h2>
        <p className='text-[13px] text-ui-text-3 mt-0.5'>{t('我们将向你的邮箱发送重置链接')}</p>
      </div>

      <div className='space-y-4'>
        <div>
          <label className='block mb-1.5 text-sm font-medium text-ui-text'>
            {t('邮箱')}
          </label>
          <input
            type='email'
            placeholder={t('请输入您的邮箱地址')}
            value={email}
            onChange={(e) => setInputs((prev) => ({ ...prev, email: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className={inputClass}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || disableButton}
          className='w-full h-11 text-sm font-medium rounded-xl transition-colors bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
        >
          {loading && <span className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />}
          {disableButton ? `${t('重试')} (${countdown})` : t('发送重置邮件')}
        </button>
      </div>

      <p className='mt-5 pt-4 border-t border-ui-border text-[13px] text-ui-text-3'>
        {t('想起来了？')}{' '}
        {embedded && onSwitchToLogin ? (
          <button onClick={onSwitchToLogin} className='text-ui-text font-medium hover:underline bg-transparent cursor-pointer'>
            {t('登录')}
          </button>
        ) : (
          <Link to='/login' className='text-ui-text font-medium hover:underline'>
            {t('登录')}
          </Link>
        )}
      </p>
    </>
  );

  if (embedded) {
    return (
      <>
        {formContent}
        {turnstileEnabled && (
          <div className='flex justify-center mt-6'>
            <Turnstile sitekey={turnstileSiteKey} onVerify={(token) => setTurnstileToken(token)} />
          </div>
        )}
      </>
    );
  }

  return (
    <div className='min-h-[calc(100vh-4rem)] flex items-start sm:items-center justify-center px-0 sm:px-4 pt-24 pb-12'>
      <div className='w-full max-w-sm sm:mt-[60px]'>
        <div className='p-6 sm:bg-ui-bg-elevated sm:rounded-2xl sm:border sm:border-ui-border sm:p-8'>
          {formContent}
        </div>
        {turnstileEnabled && (
          <div className='flex justify-center mt-6'>
            <Turnstile sitekey={turnstileSiteKey} onVerify={(token) => setTurnstileToken(token)} />
          </div>
        )}
      </div>
    </div>
  );
};

export default PasswordResetForm;

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
import { API, showError, showSuccess } from '../../helpers';
import React, { useState } from 'react';

const TwoFAVerification = ({ onSuccess, onBack, isModal = false }) => {
  const [loading, setLoading] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  const handleSubmit = async () => {
    if (!verificationCode) {
      showError('请输入验证码');
      return;
    }
    // Validate code format
    if (useBackupCode && verificationCode.length !== 8) {
      showError('备用码必须是8位');
      return;
    } else if (!useBackupCode && !/^\d{6}$/.test(verificationCode)) {
      showError('验证码必须是6位数字');
      return;
    }

    setLoading(true);
    try {
      const res = await API.post('/api/user/login/2fa', {
        code: verificationCode,
      });

      if (res.data.success) {
        showSuccess('登录成功');
        if (onSuccess) {
          onSuccess(res.data.data);
        }
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError('验证失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  if (isModal) {
    return (
      <div className='space-y-4'>
        <p className='text-ui-text-2 dark:text-ui-text-3'>
          请输入认证器应用显示的验证码完成登录
        </p>

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          <div className='mb-4'>
            <label className='block text-sm font-medium mb-1'>
              {useBackupCode ? '备用码' : '验证码'}
            </label>
            <input
              type='text'
              className='w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
              style={{ borderColor: 'var(--semi-color-border)' }}
              placeholder={useBackupCode ? '请输入8位备用码' : '请输入6位验证码'}
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              onKeyPress={handleKeyPress}
              autoFocus
            />
          </div>

          <button
            type='submit'
            disabled={loading}
            className='w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors mb-4'
          >
            {loading ? '验证中...' : '验证并登录'}
          </button>
        </form>

        <hr style={{ borderColor: 'var(--semi-color-border)' }} />

        <div style={{ textAlign: 'center' }}>
          <button
            className='text-blue-500 hover:text-blue-600 text-sm mr-4'
            onClick={() => {
              setUseBackupCode(!useBackupCode);
              setVerificationCode('');
            }}
          >
            {useBackupCode ? '使用认证器验证码' : '使用备用码'}
          </button>

          {onBack && (
            <button
              className='text-blue-500 hover:text-blue-600 text-sm'
              onClick={onBack}
            >
              返回登录
            </button>
          )}
        </div>

        <div className='bg-ui-bg-subtle dark:bg-ui-text rounded-lg p-3'>
          <span className='text-xs text-gray-500'>
            <strong>提示：</strong>
            <br />
            • 验证码每30秒更新一次
            <br />
            • 如果无法获取验证码，请使用备用码
            <br />• 每个备用码只能使用一次
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
      }}
    >
      <div className='rounded-2xl border p-8' style={{ width: 400, borderColor: 'var(--semi-color-border)', backgroundColor: 'var(--semi-color-bg-0)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h3 className='text-xl font-semibold'>两步验证</h3>
          <p className='text-gray-500 mt-2'>
            请输入认证器应用显示的验证码完成登录
          </p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          <div className='mb-4'>
            <label className='block text-sm font-medium mb-1'>
              {useBackupCode ? '备用码' : '验证码'}
            </label>
            <input
              type='text'
              className='w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
              style={{ borderColor: 'var(--semi-color-border)' }}
              placeholder={useBackupCode ? '请输入8位备用码' : '请输入6位验证码'}
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              onKeyPress={handleKeyPress}
              autoFocus
            />
          </div>

          <button
            type='submit'
            disabled={loading}
            className='w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors mb-4'
          >
            {loading ? '验证中...' : '验证并登录'}
          </button>
        </form>

        <hr style={{ borderColor: 'var(--semi-color-border)', margin: '16px 0' }} />

        <div style={{ textAlign: 'center' }}>
          <button
            className='text-blue-500 hover:text-blue-600 text-sm mr-4'
            onClick={() => {
              setUseBackupCode(!useBackupCode);
              setVerificationCode('');
            }}
          >
            {useBackupCode ? '使用认证器验证码' : '使用备用码'}
          </button>

          {onBack && (
            <button
              className='text-blue-500 hover:text-blue-600 text-sm'
              onClick={onBack}
            >
              返回登录
            </button>
          )}
        </div>

        <div
          style={{
            marginTop: 24,
            padding: 16,
            background: '#f6f8fa',
            borderRadius: 6,
          }}
        >
          <span className='text-xs text-gray-500'>
            <strong>提示：</strong>
            <br />
            • 验证码每30秒更新一次
            <br />
            • 如果无法获取验证码，请使用备用码
            <br />• 每个备用码只能使用一次
          </span>
        </div>
      </div>
    </div>
  );
};

export default TwoFAVerification;

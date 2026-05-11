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

import React, { useState } from 'react';
import { Card } from '../../../ui';

const AdminStep = ({
  setupStatus,
  formData,
  setFormData,
  renderNavigationButtons,
  t,
}) => {
  const [errors, setErrors] = useState({});

  const validate = (field, value) => {
    const newErrors = { ...errors };
    if (field === 'username') {
      newErrors.username = value.trim() ? '' : t('请输入管理员用户名');
    }
    if (field === 'password') {
      newErrors.password = !value
        ? t('请输入管理员密码')
        : value.length < 8
          ? t('密码长度至少为8个字符')
          : '';
    }
    if (field === 'confirmPassword') {
      newErrors.confirmPassword = !value
        ? t('请确认管理员密码')
        : value !== formData.password
          ? t('两次输入的密码不一致')
          : '';
    }
    setErrors(newErrors);
  };

  const inputClass =
    'w-full px-4 py-3 text-sm border border-black rounded-lg outline-none focus:ring-2 focus:ring-black bg-ui-bg-elevated';

  return (
    <>
      {setupStatus.root_init ? (
        <Card variant='filled' radius='lg' padding='lg'>
          <p className='text-ui-text-2 text-sm leading-relaxed'>
            {t('管理员账号已经初始化过，请继续设置其他参数')}
          </p>
        </Card>
      ) : (
        <div className='space-y-6'>
          <div>
            <label className='block mb-2 text-sm font-medium text-ui-text'>
              {t('用户名')}
            </label>
            <input
              type='text'
              placeholder={t('请输入管理员用户名')}
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
              onBlur={(e) => validate('username', e.target.value)}
              className={inputClass}
            />
            {errors.username && (
              <p className='mt-1 text-xs text-red-500'>{errors.username}</p>
            )}
          </div>
          <div>
            <label className='block mb-2 text-sm font-medium text-ui-text'>
              {t('密码')}
            </label>
            <input
              type='password'
              placeholder={t('请输入管理员密码')}
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              onBlur={(e) => validate('password', e.target.value)}
              className={inputClass}
            />
            {errors.password && (
              <p className='mt-1 text-xs text-red-500'>{errors.password}</p>
            )}
          </div>
          <div>
            <label className='block mb-2 text-sm font-medium text-ui-text'>
              {t('确认密码')}
            </label>
            <input
              type='password'
              placeholder={t('请确认管理员密码')}
              value={formData.confirmPassword}
              onChange={(e) =>
                setFormData({ ...formData, confirmPassword: e.target.value })
              }
              onBlur={(e) => validate('confirmPassword', e.target.value)}
              className={inputClass}
            />
            {errors.confirmPassword && (
              <p className='mt-1 text-xs text-red-500'>
                {errors.confirmPassword}
              </p>
            )}
          </div>
        </div>
      )}
      {renderNavigationButtons && renderNavigationButtons()}
    </>
  );
};

export default AdminStep;

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

import React, { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Button, inputClass } from '../../ui';

const LogsFilters = ({
  formInitValues,
  setFormApi,
  refresh,
  setShowColumnSelector,
  formApi,
  setLogType,
  loading,
  isAdminUser,
  t,
}) => {
  const [values, setValues] = useState(formInitValues || {});

  const apiRef = useRef(null);
  if (!apiRef.current) {
    apiRef.current = {
      getValues: () => values,
      getValue: (field) => values[field],
      setValue: (field, val) => setValues((prev) => ({ ...prev, [field]: val })),
      setValues: (v) => setValues((prev) => ({ ...prev, ...v })),
      reset: () => setValues(formInitValues || {}),
    };
  }
  // Keep in sync
  apiRef.current.getValues = () => values;
  apiRef.current.getValue = (field) => values[field];

  useEffect(() => {
    setFormApi(apiRef.current);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    refresh();
  };

  const handleReset = () => {
    setValues(formInitValues || {});
    setLogType(0);
    setTimeout(() => {
      refresh();
    }, 100);
  };

  const inputCls = inputClass({ variant: 'admin', size: 'md', className: 'pl-9' });

  return (
    <form
      onSubmit={handleSubmit}
      autoComplete='off'
    >
      <div className='flex flex-col gap-2'>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2'>
          {/* 时间选择器 - using two datetime-local inputs */}
          <div className='col-span-1 lg:col-span-2 flex gap-2'>
            <input
              type='datetime-local'
              value={values.start_timestamp || ''}
              onChange={(e) => setValues((prev) => ({ ...prev, start_timestamp: e.target.value }))}
              placeholder={t('开始时间')}
              className={inputClass({ variant: 'admin', size: 'md', className: 'flex-1' })}
            />
            <input
              type='datetime-local'
              value={values.end_timestamp || ''}
              onChange={(e) => setValues((prev) => ({ ...prev, end_timestamp: e.target.value }))}
              placeholder={t('结束时间')}
              className={inputClass({ variant: 'admin', size: 'md', className: 'flex-1' })}
            />
          </div>

          {/* 其他搜索字段 */}
          <div className='relative'>
            <span className='absolute left-3 top-1/2 -translate-y-1/2 text-ui-text-3'><Search size={14} /></span>
            <input
              type='text'
              value={values.token_name || ''}
              onChange={(e) => setValues((prev) => ({ ...prev, token_name: e.target.value }))}
              placeholder={t('令牌名称')}
              className={inputCls}
            />
          </div>

          <div className='relative'>
            <span className='absolute left-3 top-1/2 -translate-y-1/2 text-ui-text-3'><Search size={14} /></span>
            <input
              type='text'
              value={values.model_name || ''}
              onChange={(e) => setValues((prev) => ({ ...prev, model_name: e.target.value }))}
              placeholder={t('模型名称')}
              className={inputCls}
            />
          </div>

          <div className='relative'>
            <span className='absolute left-3 top-1/2 -translate-y-1/2 text-ui-text-3'><Search size={14} /></span>
            <input
              type='text'
              value={values.group || ''}
              onChange={(e) => setValues((prev) => ({ ...prev, group: e.target.value }))}
              placeholder={t('分组')}
              className={inputCls}
            />
          </div>

          <div className='relative'>
            <span className='absolute left-3 top-1/2 -translate-y-1/2 text-ui-text-3'><Search size={14} /></span>
            <input
              type='text'
              value={values.request_id || ''}
              onChange={(e) => setValues((prev) => ({ ...prev, request_id: e.target.value }))}
              placeholder={t('Request ID')}
              className={inputCls}
            />
          </div>

          {isAdminUser && (
            <>
              <div className='relative'>
                <span className='absolute left-3 top-1/2 -translate-y-1/2 text-ui-text-3'><Search size={14} /></span>
                <input
                  type='text'
                  value={values.channel || ''}
                  onChange={(e) => setValues((prev) => ({ ...prev, channel: e.target.value }))}
                  placeholder={t('渠道 ID')}
                  className={inputCls}
                />
              </div>
              <div className='relative'>
                <span className='absolute left-3 top-1/2 -translate-y-1/2 text-ui-text-3'><Search size={14} /></span>
                <input
                  type='text'
                  value={values.username || ''}
                  onChange={(e) => setValues((prev) => ({ ...prev, username: e.target.value }))}
                  placeholder={t('用户名称')}
                  className={inputCls}
                />
              </div>
            </>
          )}
        </div>

        {/* 操作按钮区域 */}
        <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3'>
          {/* 日志类型选择器 */}
          <div className='w-full sm:w-auto'>
            <select
              value={values.logType || '0'}
              onChange={(e) => {
                setValues((prev) => ({ ...prev, logType: e.target.value }));
                setTimeout(() => {
                  refresh();
                }, 0);
              }}
              className={inputClass({ variant: 'admin', size: 'md', className: 'sm:w-auto min-w-[120px] cursor-pointer' })}
            >
              <option value='0'>{t('全部')}</option>
              <option value='1'>{t('充值')}</option>
              <option value='2'>{t('消费')}</option>
              <option value='3'>{t('管理')}</option>
              <option value='4'>{t('系统')}</option>
              <option value='5'>{t('错误')}</option>
              <option value='6'>{t('退款')}</option>
            </select>
          </div>

          <div className='flex gap-2 w-full sm:w-auto justify-end'>
            <Button
              type='submit'
              variant='ghost'
              disabled={loading}
            >
              {t('查询')}
            </Button>
            <Button
              type='button'
              variant='ghost'
              onClick={handleReset}
            >
              {t('重置')}
            </Button>
            <Button
              type='button'
              variant='ghost'
              onClick={() => setShowColumnSelector(true)}
            >
              {t('列设置')}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default LogsFilters;

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

import React, { useState, useEffect } from 'react';
import { Code, Edit, Check, X, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, Switch } from '../ui';

const CustomRequestEditor = ({ customRequestMode, customRequestBody, onCustomRequestModeChange, onCustomRequestBodyChange, defaultPayload }) => {
  const { t } = useTranslation();
  const [isValid, setIsValid] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [localValue, setLocalValue] = useState(customRequestBody || '');

  useEffect(() => {
    if (customRequestMode && (!customRequestBody || customRequestBody.trim() === '')) {
      const defaultJson = defaultPayload ? JSON.stringify(defaultPayload, null, 2) : '';
      setLocalValue(defaultJson);
      onCustomRequestBodyChange(defaultJson);
    }
  }, [customRequestMode, defaultPayload, customRequestBody, onCustomRequestBodyChange]);

  useEffect(() => {
    if (customRequestBody !== localValue) {
      setLocalValue(customRequestBody || '');
      validateJson(customRequestBody || '');
    }
  }, [customRequestBody]);

  const validateJson = (value) => {
    if (!value.trim()) { setIsValid(true); setErrorMessage(''); return true; }
    try {
      JSON.parse(value); setIsValid(true); setErrorMessage(''); return true;
    } catch (error) {
      setIsValid(false); setErrorMessage(`${t('JSON格式错误')}: ${error.message}`); return false;
    }
  };

  const handleValueChange = (e) => {
    const value = e.target.value;
    setLocalValue(value);
    validateJson(value);
    onCustomRequestBodyChange(value);
  };

  const handleModeToggle = () => {
    const enabled = !customRequestMode;
    onCustomRequestModeChange(enabled);
    if (enabled && defaultPayload) {
      const defaultJson = JSON.stringify(defaultPayload, null, 2);
      setLocalValue(defaultJson);
      onCustomRequestBodyChange(defaultJson);
    }
  };

  const formatJson = () => {
    try {
      const formatted = JSON.stringify(JSON.parse(localValue), null, 2);
      setLocalValue(formatted);
      onCustomRequestBodyChange(formatted);
      setIsValid(true); setErrorMessage('');
    } catch {}
  };

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <Code size={14} className='text-ui-text-3' />
          <span className='text-sm font-medium'>{t('自定义请求体模式')}</span>
        </div>
        <Switch
          size='sm'
          checked={!!customRequestMode}
          onChange={handleModeToggle}
          aria-label={t('自定义请求体模式')}
        />
      </div>

      {customRequestMode && (
        <>
          <div className='flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg'>
            <AlertTriangle size={14} className='text-orange-500 flex-shrink-0 mt-0.5' />
            <p className='text-xs text-orange-700'>{t('启用此模式后，将使用您自定义的请求体发送API请求，模型配置面板的参数设置将被忽略。')}</p>
          </div>

          <div>
            <div className='flex items-center justify-between mb-2'>
              <span className='text-sm font-medium'>{t('请求体 JSON')}</span>
              <div className='flex items-center gap-2'>
                {isValid
                  ? <span className='flex items-center gap-1 text-green-600 text-xs'><Check size={12} />{t('格式正确')}</span>
                  : <span className='flex items-center gap-1 text-red-500 text-xs'><X size={12} />{t('格式错误')}</span>
                }
                <Button
                  variant='ghost'
                  size='sm'
                  icon={Edit}
                  onClick={formatJson}
                  disabled={!isValid}
                >
                  {t('格式化')}
                </Button>
              </div>
            </div>

            <textarea
              value={localValue}
              onChange={handleValueChange}
              placeholder='{"model": "gpt-4o", "messages": [...], ...}'
              rows={10}
              className={`w-full px-3 py-2 text-xs border rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-black bg-ui-bg-elevated ${!isValid ? 'border-red-400' : 'border-gray-200'}`}
              style={{ fontFamily: "'JetBrains Mono', 'SF Mono', ui-monospace, Menlo, Consolas, monospace", lineHeight: '1.5', minHeight: '160px' }}
            />

            {!isValid && errorMessage && (
              <p className='text-xs text-red-500 mt-1'>{errorMessage}</p>
            )}
            <p className='text-xs text-ui-text-3 mt-1'>{t('请输入有效的JSON格式的请求体。您可以参考预览面板中的默认请求体格式。')}</p>
          </div>
        </>
      )}
    </div>
  );
};

export default CustomRequestEditor;

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
import { Sparkles, Users, ToggleLeft, X, Settings, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ParameterControl from './ParameterControl';
import ImageUrlInput from './ImageUrlInput';
import ConfigManager from './ConfigManager';
import CustomRequestEditor from './CustomRequestEditor';

const NativeSelect = ({ value, onChange, options, placeholder, disabled, filter }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = filter && search
    ? options.filter((o) => String(o.label || o.value || '').toLowerCase().includes(search.toLowerCase()))
    : options;

  const selectedLabel = options.find((o) => o.value === value)?.label || value || placeholder;

  return (
    <div className='relative'>
      <button
        type='button'
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className='w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-gray-400 transition-colors text-left'
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>{selectedLabel}</span>
        <ChevronDown size={14} className='text-gray-400 flex-shrink-0' />
      </button>
      {open && (
        <>
          <div className='fixed inset-0 z-40' onClick={() => setOpen(false)} />
          <div className='absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden'>
            {filter && (
              <div className='p-2 border-b border-gray-100'>
                <input
                  type='text'
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder='搜索...'
                  className='w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none'
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
            <div className='max-h-48 overflow-y-auto'>
              {filtered.map((opt) => (
                <button
                  key={opt.value}
                  type='button'
                  onClick={() => { onChange(opt.value); setOpen(false); setSearch(''); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${opt.value === value ? 'bg-gray-100 font-medium' : ''}`}
                >
                  {opt.label || opt.value}
                </button>
              ))}
              {filtered.length === 0 && <div className='px-3 py-2 text-xs text-gray-400'>无匹配结果</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const SettingsPanel = ({
  inputs, parameterEnabled, models, groups, styleState,
  showDebugPanel, customRequestMode, customRequestBody,
  onInputChange, onParameterToggle, onCloseSettings,
  onConfigImport, onConfigReset, onCustomRequestModeChange,
  onCustomRequestBodyChange, previewPayload, messages,
}) => {
  const { t } = useTranslation();

  const currentConfig = { inputs, parameterEnabled, showDebugPanel, customRequestMode, customRequestBody };

  return (
    <div className='h-full flex flex-col' style={{ padding: styleState.isMobile ? '16px' : '24px' }}>
      {/* 标题 */}
      <div className='flex items-center justify-between mb-5 flex-shrink-0'>
        <div className='flex items-center gap-3'>
          <div className='w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center'>
            <Settings size={16} className='text-white' />
          </div>
          <span className='font-semibold text-gray-900'>{t('模型配置')}</span>
        </div>
        {styleState.isMobile && onCloseSettings && (
          <button onClick={onCloseSettings} className='w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors'>
            <X size={16} />
          </button>
        )}
      </div>

      {/* 移动端配置管理 */}
      {styleState.isMobile && (
        <div className='mb-4 flex-shrink-0'>
          <ConfigManager currentConfig={currentConfig} onConfigImport={onConfigImport} onConfigReset={onConfigReset} styleState={{ ...styleState, isMobile: false }} messages={messages} />
        </div>
      )}

      <div className='space-y-5 overflow-y-auto flex-1 pr-1'>
        {/* 自定义请求体 */}
        <CustomRequestEditor
          customRequestMode={customRequestMode} customRequestBody={customRequestBody}
          onCustomRequestModeChange={onCustomRequestModeChange} onCustomRequestBodyChange={onCustomRequestBodyChange}
          defaultPayload={previewPayload}
        />

        {/* 分组 */}
        <div className={customRequestMode ? 'opacity-50 pointer-events-none' : ''}>
          <div className='flex items-center gap-2 mb-2'>
            <Users size={14} className='text-gray-400' />
            <span className='text-sm font-medium'>{t('分组')}</span>
            {customRequestMode && <span className='text-xs text-orange-600'>({t('已在自定义模式中忽略')})</span>}
          </div>
          <NativeSelect
            value={inputs.group}
            onChange={(v) => onInputChange('group', v)}
            options={groups || []}
            placeholder={t('请选择分组')}
            disabled={customRequestMode}
            filter
          />
        </div>

        {/* 模型 */}
        <div className={customRequestMode ? 'opacity-50 pointer-events-none' : ''}>
          <div className='flex items-center gap-2 mb-2'>
            <Sparkles size={14} className='text-gray-400' />
            <span className='text-sm font-medium'>{t('模型')}</span>
            {customRequestMode && <span className='text-xs text-orange-600'>({t('已在自定义模式中忽略')})</span>}
          </div>
          <NativeSelect
            value={inputs.model}
            onChange={(v) => onInputChange('model', v)}
            options={models || []}
            placeholder={t('请选择模型')}
            disabled={customRequestMode}
            filter
          />
        </div>

        {/* 图片URL */}
        <div className={customRequestMode ? 'opacity-50 pointer-events-none' : ''}>
          <ImageUrlInput
            imageUrls={inputs.imageUrls} imageEnabled={inputs.imageEnabled}
            onImageUrlsChange={(urls) => onInputChange('imageUrls', urls)}
            onImageEnabledChange={(enabled) => onInputChange('imageEnabled', enabled)}
            disabled={customRequestMode}
          />
        </div>

        {/* 参数控制 */}
        <div className={customRequestMode ? 'opacity-50 pointer-events-none' : ''}>
          <ParameterControl inputs={inputs} parameterEnabled={parameterEnabled} onInputChange={onInputChange} onParameterToggle={onParameterToggle} disabled={customRequestMode} />
        </div>

        {/* 流式输出 */}
        <div className={customRequestMode ? 'opacity-50 pointer-events-none' : ''}>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <ToggleLeft size={14} className='text-gray-400' />
              <span className='text-sm font-medium'>{t('流式输出')}</span>
              {customRequestMode && <span className='text-xs text-orange-600'>({t('已在自定义模式中忽略')})</span>}
            </div>
            <button
              onClick={() => !customRequestMode && onInputChange('stream', !inputs.stream)}
              disabled={customRequestMode}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-40 ${inputs.stream ? 'bg-black' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${inputs.stream ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 桌面端配置管理底部 */}
      {!styleState.isMobile && (
        <div className='flex-shrink-0 pt-4 border-t border-gray-100 mt-4'>
          <ConfigManager currentConfig={currentConfig} onConfigImport={onConfigImport} onConfigReset={onConfigReset} styleState={styleState} messages={messages} />
        </div>
      )}
    </div>
  );
};

export default SettingsPanel;

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
import { Sparkles, Users, ToggleLeft, X, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ParameterControl from './ParameterControl';
import ImageUrlInput from './ImageUrlInput';
import ConfigManager from './ConfigManager';
import CustomRequestEditor from './CustomRequestEditor';
import { Combobox, Switch, IconButton } from '../ui';

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
          <span className='font-semibold text-ui-text'>{t('模型配置')}</span>
        </div>
        {styleState.isMobile && onCloseSettings && (
          <IconButton icon={X} size='sm' onClick={onCloseSettings} title={t('关闭')} />
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
            <Users size={14} className='text-ui-text-3' />
            <span className='text-sm font-medium'>{t('分组')}</span>
            {customRequestMode && <span className='text-xs text-orange-600'>({t('已在自定义模式中忽略')})</span>}
          </div>
          <Combobox
            value={inputs.group}
            onChange={(v) => onInputChange('group', v)}
            options={groups || []}
            placeholder={t('请选择分组')}
            disabled={customRequestMode}
          />
        </div>

        {/* 模型 */}
        <div className={customRequestMode ? 'opacity-50 pointer-events-none' : ''}>
          <div className='flex items-center gap-2 mb-2'>
            <Sparkles size={14} className='text-ui-text-3' />
            <span className='text-sm font-medium'>{t('模型')}</span>
            {customRequestMode && <span className='text-xs text-orange-600'>({t('已在自定义模式中忽略')})</span>}
          </div>
          <Combobox
            value={inputs.model}
            onChange={(v) => onInputChange('model', v)}
            options={models || []}
            placeholder={t('请选择模型')}
            disabled={customRequestMode}
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
              <ToggleLeft size={14} className='text-ui-text-3' />
              <span className='text-sm font-medium'>{t('流式输出')}</span>
              {customRequestMode && <span className='text-xs text-orange-600'>({t('已在自定义模式中忽略')})</span>}
            </div>
            <Switch
              size='sm'
              checked={!!inputs.stream}
              disabled={customRequestMode}
              onChange={(v) => onInputChange('stream', v)}
              aria-label={t('流式输出')}
            />
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

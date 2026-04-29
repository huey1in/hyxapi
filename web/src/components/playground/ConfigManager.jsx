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

import React, { useRef, useState } from 'react';
import { Download, Upload, RotateCcw, Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { exportConfig, importConfig, clearConfig, hasStoredConfig, getConfigTimestamp } from './configStorage';
import { showSuccess, showError } from '../../helpers';

const ConfirmDialog = ({ title, content, okText, cancelText, onOk, onCancel, danger }) => (
  <div className='fixed inset-0 z-[9999] flex items-center justify-center bg-black/40'>
    <div className='bg-white rounded-2xl p-6 w-80 shadow-xl'>
      <h3 className='font-semibold text-gray-900 mb-2'>{title}</h3>
      <p className='text-sm text-gray-600 mb-6'>{content}</p>
      <div className='flex gap-2 justify-end'>
        <button onClick={onCancel} className='px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors'>{cancelText}</button>
        <button onClick={onOk} className={`px-4 py-2 text-sm text-white rounded-lg transition-colors ${danger ? 'bg-red-500 hover:bg-red-600' : 'bg-black hover:bg-[#333]'}`}>{okText}</button>
      </div>
    </div>
  </div>
);

const ConfigManager = ({ currentConfig, onConfigImport, onConfigReset, styleState, messages }) => {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const [dialog, setDialog] = useState(null);
  const [showMenu, setShowMenu] = useState(false);

  const closeDialog = () => setDialog(null);

  const handleExport = () => {
    try {
      const configWithTimestamp = { ...currentConfig, timestamp: new Date().toISOString() };
      localStorage.setItem('playground_config', JSON.stringify(configWithTimestamp));
      exportConfig(currentConfig, messages);
      showSuccess(t('配置已导出到下载文件夹'));
    } catch (error) {
      showError(t('导出配置失败: ') + error.message);
    }
    setShowMenu(false);
  };

  const handleImportClick = () => { fileInputRef.current?.click(); setShowMenu(false); };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const importedConfig = await importConfig(file);
      setDialog({
        title: t('确认导入配置'),
        content: t('导入的配置将覆盖当前设置，是否继续？'),
        okText: t('确定导入'),
        cancelText: t('取消'),
        onOk: () => { onConfigImport(importedConfig); showSuccess(t('配置导入成功')); closeDialog(); },
        onCancel: closeDialog,
      });
    } catch (error) {
      showError(t('导入配置失败: ') + error.message);
    } finally {
      event.target.value = '';
    }
  };

  const handleReset = () => {
    setShowMenu(false);
    setDialog({
      title: t('重置配置'),
      content: t('将清除所有保存的配置并恢复默认设置，此操作不可撤销。是否继续？'),
      okText: t('确定重置'),
      cancelText: t('取消'),
      danger: true,
      onOk: () => {
        closeDialog();
        setDialog({
          title: t('重置选项'),
          content: t('是否同时重置对话消息？选择"是"将清空所有对话记录并恢复默认示例；选择"否"将保留当前对话记录。'),
          okText: t('同时重置消息'),
          cancelText: t('仅重置配置'),
          danger: true,
          onOk: () => { clearConfig(); onConfigReset({ resetMessages: true }); showSuccess(t('配置和消息已全部重置')); closeDialog(); },
          onCancel: () => { clearConfig(); onConfigReset({ resetMessages: false }); showSuccess(t('配置已重置，对话消息已保留')); closeDialog(); },
        });
      },
      onCancel: closeDialog,
    });
  };

  const getConfigStatus = () => {
    if (hasStoredConfig()) {
      const timestamp = getConfigTimestamp();
      if (timestamp) return t('上次保存: ') + new Date(timestamp).toLocaleString();
      return t('已有保存的配置');
    }
    return t('暂无保存的配置');
  };

  const btnBase = 'flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors';

  return (
    <>
      {dialog && <ConfirmDialog {...dialog} />}
      <input ref={fileInputRef} type='file' accept='.json' onChange={handleFileChange} style={{ display: 'none' }} />

      {styleState.isMobile ? (
        <div className='relative'>
          <button onClick={() => setShowMenu(!showMenu)} className='w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors'>
            <Settings2 size={16} />
          </button>
          {showMenu && (
            <div className='absolute left-0 top-9 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 w-36'>
              <button onClick={handleExport} className={`${btnBase} w-full text-gray-700 hover:bg-gray-50`}><Download size={13} />{t('导出配置')}</button>
              <button onClick={handleImportClick} className={`${btnBase} w-full text-gray-700 hover:bg-gray-50`}><Upload size={13} />{t('导入配置')}</button>
              <div className='h-px bg-gray-100 my-1' />
              <button onClick={handleReset} className={`${btnBase} w-full text-red-600 hover:bg-red-50`}><RotateCcw size={13} />{t('重置配置')}</button>
            </div>
          )}
        </div>
      ) : (
        <div className='space-y-2'>
          <div className='flex items-center justify-between'>
            <span className='text-xs text-gray-400'>{getConfigStatus()}</span>
            <button onClick={handleReset} title={t('重置配置')} className='w-6 h-6 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors'>
              <RotateCcw size={12} />
            </button>
          </div>
          <div className='flex gap-2'>
            <button onClick={handleExport} className='flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs bg-black text-white rounded-lg hover:bg-[#333] transition-colors'>
              <Download size={11} />{t('导出')}
            </button>
            <button onClick={handleImportClick} className='flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors'>
              <Upload size={11} />{t('导入')}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ConfigManager;

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
import { Button, IconButton, Dropdown, ConfirmDialog } from '../ui';

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
      {dialog && (
        <ConfirmDialog
          open
          title={dialog.title}
          description={dialog.content}
          confirmText={dialog.okText}
          cancelText={dialog.cancelText}
          danger={dialog.danger}
          onConfirm={dialog.onOk}
          onCancel={dialog.onCancel}
        />
      )}
      <input ref={fileInputRef} type='file' accept='.json' onChange={handleFileChange} style={{ display: 'none' }} />

      {styleState.isMobile ? (
        <Dropdown
          placement='bottom-start'
          trigger={<IconButton icon={Settings2} size='sm' />}
          items={[
            { label: t('导出配置'), onClick: handleExport },
            { label: t('导入配置'), onClick: handleImportClick },
            { label: t('重置配置'), onClick: handleReset, danger: true },
          ]}
        />
      ) : (
        <div className='space-y-2'>
          <div className='flex items-center justify-between'>
            <span className='text-xs text-ui-text-3'>{getConfigStatus()}</span>
            <IconButton
              icon={RotateCcw}
              size='sm'
              variant='danger'
              title={t('重置配置')}
              onClick={handleReset}
              className='w-6 h-6'
            />
          </div>
          <div className='flex gap-2'>
            <Button size='sm' icon={Download} onClick={handleExport} className='flex-1'>
              {t('导出')}
            </Button>
            <Button size='sm' variant='secondary' icon={Upload} onClick={handleImportClick} className='flex-1'>
              {t('导入')}
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default ConfigManager;

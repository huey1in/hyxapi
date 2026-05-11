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
import { Code, Zap, Clock, X, Eye, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CodeViewer from './CodeViewer';
import SSEViewer from './SSEViewer';
import { Button, IconButton } from '../ui';

const TABS = [
  { key: 'preview', icon: Eye, label: '预览请求体' },
  { key: 'request', icon: Send, label: '实际请求体' },
  { key: 'response', icon: Zap, label: '响应' },
];

const DebugPanel = ({ debugData, activeDebugTab, onActiveDebugTabChange, styleState, onCloseDebugPanel, customRequestMode }) => {
  const { t } = useTranslation();
  const [activeKey, setActiveKey] = useState(activeDebugTab);

  useEffect(() => { setActiveKey(activeDebugTab); }, [activeDebugTab]);

  const handleTabChange = (key) => { setActiveKey(key); onActiveDebugTabChange(key); };

  return (
    <div className='h-full flex flex-col' style={{ padding: styleState.isMobile ? '16px' : '24px' }}>
      {/* 头部 */}
      <div className='flex items-center justify-between mb-4 flex-shrink-0'>
        <div className='flex items-center gap-3'>
          <div className='w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-blue-500 flex items-center justify-center'>
            <Code size={16} className='text-white' />
          </div>
          <span className='font-semibold text-ui-text'>{t('调试信息')}</span>
        </div>
        {styleState.isMobile && onCloseDebugPanel && (
          <IconButton icon={X} size='sm' onClick={onCloseDebugPanel} title={t('关闭')} />
        )}
      </div>

      {/* Tab 切换 */}
      <div className='flex gap-1 mb-3 flex-shrink-0 border-b border-gray-200'>
        {TABS.map(({ key, icon: Icon, label }) => (
          <Button
            key={key}
            variant='tab'
            size='sm'
            selected={activeKey === key}
            icon={Icon}
            onClick={() => handleTabChange(key)}
          >
            {t(label)}
            {key === 'response' && debugData.sseMessages?.length > 0 && (
              <span className='px-1.5 py-0.5 text-xs bg-blue-100 text-blue-600 rounded-full ml-1'>SSE ({debugData.sseMessages.length})</span>
            )}
            {key === 'preview' && customRequestMode && (
              <span className='px-1.5 py-0.5 text-xs bg-orange-100 text-orange-600 rounded-full ml-1'>自定义</span>
            )}
          </Button>
        ))}
      </div>

      {/* 内容 */}
      <div className='flex-1 overflow-hidden'>
        {activeKey === 'preview' && <CodeViewer content={debugData.previewRequest} title='preview' language='json' />}
        {activeKey === 'request' && <CodeViewer content={debugData.request} title='request' language='json' />}
        {activeKey === 'response' && (
          debugData.sseMessages?.length > 0
            ? <SSEViewer sseData={debugData.sseMessages} title='response' />
            : <CodeViewer content={debugData.response} title='response' language='json' />
        )}
      </div>

      {/* 时间戳 */}
      {(debugData.timestamp || debugData.previewTimestamp) && (
        <div className='flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 flex-shrink-0'>
          <Clock size={12} className='text-ui-text-3' />
          <span className='text-xs text-ui-text-3'>
            {activeKey === 'preview' && debugData.previewTimestamp
              ? `${t('预览更新')}: ${new Date(debugData.previewTimestamp).toLocaleString()}`
              : debugData.timestamp ? `${t('最后请求')}: ${new Date(debugData.timestamp).toLocaleString()}` : ''}
          </span>
        </div>
      )}
    </div>
  );
};

export default DebugPanel;

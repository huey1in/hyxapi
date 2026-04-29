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

import React, { useState, useMemo, useCallback } from 'react';
import { Copy, ChevronDown, ChevronUp, Zap, CheckCircle, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { copy, showSuccess, showError } from '../../helpers';

const SSEViewer = ({ sseData }) => {
  const { t } = useTranslation();
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [copied, setCopied] = useState(false);

  const parsedSSEData = useMemo(() => {
    if (!sseData || !Array.isArray(sseData)) return [];
    return sseData.map((item, index) => {
      let parsed = null, error = null, isDone = false;
      if (item === '[DONE]') { isDone = true; }
      else { try { parsed = typeof item === 'string' ? JSON.parse(item) : item; } catch (e) { error = e.message; } }
      return { index, raw: item, parsed, error, isDone, key: `sse-${index}` };
    });
  }, [sseData]);

  const stats = useMemo(() => {
    const total = parsedSSEData.length;
    const errors = parsedSSEData.filter((i) => i.error).length;
    const done = parsedSSEData.filter((i) => i.isDone).length;
    return { total, errors, done, valid: total - errors - done };
  }, [parsedSSEData]);

  const toggleItem = (key) => setExpandedKeys((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);

  const handleToggleAll = useCallback(() => {
    setExpandedKeys((prev) => prev.length === parsedSSEData.length ? [] : parsedSSEData.map((i) => i.key));
  }, [parsedSSEData]);

  const handleCopyAll = useCallback(async () => {
    try {
      const allData = parsedSSEData.map((i) => i.parsed ? JSON.stringify(i.parsed, null, 2) : i.raw).join('\n\n');
      await copy(allData);
      setCopied(true); showSuccess(t('已复制全部数据'));
      setTimeout(() => setCopied(false), 2000);
    } catch { showError(t('复制失败')); }
  }, [parsedSSEData, t]);

  const handleCopySingle = useCallback(async (item) => {
    try { await copy(item.parsed ? JSON.stringify(item.parsed, null, 2) : item.raw); showSuccess(t('已复制')); }
    catch { showError(t('复制失败')); }
  }, [t]);

  const renderSSEItem = (item) => {
    if (item.isDone) return (
      <div className='flex items-center gap-2 p-3 bg-green-50 rounded-lg'>
        <CheckCircle size={14} className='text-green-600' />
        <span className='text-green-600 text-xs font-medium'>{t('流式响应完成')} [DONE]</span>
      </div>
    );
    if (item.error) return (
      <div className='space-y-2'>
        <div className='flex items-center gap-2 p-3 bg-red-50 rounded-lg'>
          <XCircle size={14} className='text-red-600' />
          <span className='text-red-600 text-xs'>{t('解析错误')}: {item.error}</span>
        </div>
        <div className='p-3 bg-gray-100 rounded-lg font-mono text-xs overflow-auto'><pre>{item.raw}</pre></div>
      </div>
    );
    return (
      <div className='space-y-2'>
        <div className='relative'>
          <pre className='p-3 bg-gray-900 text-gray-100 rounded-lg overflow-auto text-xs font-mono leading-relaxed'>
            {JSON.stringify(item.parsed, null, 2)}
          </pre>
          <button onClick={() => handleCopySingle(item)} className='absolute top-2 right-2 w-6 h-6 flex items-center justify-center bg-gray-700/80 text-gray-300 rounded hover:bg-gray-600 transition-colors'>
            <Copy size={11} />
          </button>
        </div>
        {item.parsed?.choices?.[0] && (
          <div className='flex flex-wrap gap-1.5 text-xs'>
            {item.parsed.choices[0].delta?.content && <span className='px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full'>{t('内容')}: "{String(item.parsed.choices[0].delta.content).substring(0, 20)}..."</span>}
            {item.parsed.choices[0].delta?.reasoning_content && <span className='px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full'>{t('有 Reasoning')}</span>}
            {item.parsed.choices[0].finish_reason && <span className='px-2 py-0.5 bg-green-100 text-green-700 rounded-full'>{t('完成')}: {item.parsed.choices[0].finish_reason}</span>}
            {item.parsed.usage && <span className='px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full'>{t('令牌')}: {item.parsed.usage.prompt_tokens || 0}/{item.parsed.usage.completion_tokens || 0}</span>}
          </div>
        )}
      </div>
    );
  };

  if (!parsedSSEData.length) return (
    <div className='flex items-center justify-center h-full min-h-[200px] text-gray-400 text-sm'>{t('暂无SSE响应数据')}</div>
  );

  return (
    <div className='h-full flex flex-col bg-[#fafafa] rounded-lg'>
      <div className='flex items-center justify-between p-3 border-b border-gray-200 flex-shrink-0'>
        <div className='flex items-center gap-2'>
          <Zap size={14} className='text-blue-500' />
          <span className='text-sm font-medium'>{t('SSE数据流')}</span>
          <span className='px-1.5 py-0.5 text-xs bg-blue-100 text-blue-600 rounded-full'>{stats.total}</span>
          {stats.errors > 0 && <span className='px-1.5 py-0.5 text-xs bg-red-100 text-red-600 rounded-full'>{stats.errors} {t('错误')}</span>}
        </div>
        <div className='flex items-center gap-1'>
          <button onClick={handleCopyAll} className='flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors'>
            <Copy size={11} />{copied ? t('已复制') : t('复制全部')}
          </button>
          <button onClick={handleToggleAll} className='flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors'>
            {expandedKeys.length === parsedSSEData.length ? <><ChevronUp size={11} />{t('收起')}</> : <><ChevronDown size={11} />{t('展开')}</>}
          </button>
        </div>
      </div>

      <div className='flex-1 overflow-auto p-3 space-y-2'>
        {parsedSSEData.map((item) => (
          <div key={item.key} className='bg-white border border-gray-200 rounded-lg overflow-hidden'>
            <button
              onClick={() => toggleItem(item.key)}
              className='w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors'
            >
              <span className='px-1.5 py-0.5 text-xs bg-gray-100 text-gray-500 rounded-full flex-shrink-0'>#{item.index + 1}</span>
              {item.isDone ? <span className='text-green-600 font-medium text-xs'>[DONE]</span>
                : item.error ? <span className='text-red-600 text-xs'>{t('解析错误')}</span>
                : <span className='text-gray-600 text-xs'>{item.parsed?.id || item.parsed?.object || t('SSE 事件')}</span>
              }
              <div className='ml-auto'>{expandedKeys.includes(item.key) ? <ChevronUp size={13} className='text-gray-400' /> : <ChevronDown size={13} className='text-gray-400' />}</div>
            </button>
            {expandedKeys.includes(item.key) && <div className='px-3 pb-3'>{renderSSEItem(item)}</div>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SSEViewer;

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

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Eye, EyeOff, Square, Trash2, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePlayground } from '../../contexts/PlaygroundContext';
import { showWarning, showSuccess } from '../../helpers';

const ChatArea = ({
  chatRef,
  message,
  inputs,
  styleState,
  showDebugPanel,
  roleInfo,
  onMessageSend,
  onMessageCopy,
  onMessageReset,
  onMessageDelete,
  onStopGenerator,
  onClearMessages,
  onToggleDebugPanel,
  renderCustomChatContent,
  renderChatBoxAction,
}) => {
  const { t } = useTranslation();
  const { onPasteImage, imageEnabled } = usePlayground();
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const [inputValue, setInputValue] = useState('');
  const isGenerating = message.some((m) => m.status === 'loading' || m.status === 'incomplete');

  // 暴露 chatRef（供外部调用）
  useEffect(() => {
    if (chatRef) chatRef.current = { scrollToBottom: () => scrollToBottom() };
  }, [chatRef]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [message, scrollToBottom]);

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text || isGenerating) return;
    setInputValue('');
    onMessageSend(text, null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePaste = useCallback(async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        if (!imageEnabled) {
          showWarning(t('请先在设置中启用图片功能'));
          return;
        }
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (onPasteImage) {
              onPasteImage(event.target.result);
              showSuccess(t('图片已添加'));
            }
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  }, [onPasteImage, imageEnabled, t]);

  const getRoleBubbleClass = (role) => {
    if (role === 'user') return 'bg-black text-white';
    if (role === 'system') return 'bg-amber-50 border border-amber-200 text-ui-text';
    return 'bg-[#fafafa] border border-gray-200 text-ui-text';
  };

  const isUserRole = (role) => role === 'user';

  return (
    <div className='flex flex-col h-full'>
      {/* 头部 */}
      {!styleState.isMobile && (
        <div className='flex items-center justify-between px-6 py-3 border-b border-gray-200 flex-shrink-0'>
          <span className='text-sm font-medium text-ui-text'>
            {inputs.model || t('选择模型开始对话')}
          </span>
          <button
            onClick={onToggleDebugPanel}
            className='flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-ui-text-2 hover:bg-ui-bg-subtle transition-colors'
          >
            {showDebugPanel ? <EyeOff size={13} /> : <Eye size={13} />}
            {showDebugPanel ? t('隐藏调试') : t('显示调试')}
          </button>
        </div>
      )}

      {/* 消息列表 */}
      <div ref={scrollRef} className='flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4'>
        {message.length === 0 && (
          <div className='flex items-center justify-center h-full text-ui-text-3 text-sm'>
            {t('请输入您的问题...')}
          </div>
        )}
        {message.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${isUserRole(msg.role) ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* 头像 */}
            <div className='flex-shrink-0'>
              <img
                src={isUserRole(msg.role) ? roleInfo.user?.avatar : roleInfo.assistant?.avatar}
                alt={msg.role}
                className='w-7 h-7 rounded-full object-cover border border-gray-200'
              />
            </div>

            {/* 消息气泡 */}
            <div className={`max-w-[80%] ${isUserRole(msg.role) ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
              <div className={`px-4 py-3 rounded-2xl text-sm ${getRoleBubbleClass(msg.role)}`}>
                {renderCustomChatContent
                  ? renderCustomChatContent({ message: msg, className: '' })
                  : <span>{typeof msg.content === 'string' ? msg.content : ''}</span>
                }
              </div>
              {/* 操作按钮 */}
              <div className={`${isUserRole(msg.role) ? 'self-end' : 'self-start'}`}>
                {renderChatBoxAction && renderChatBoxAction({ message: msg })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 输入区域 */}
      <div className='flex-shrink-0 px-4 sm:px-6 py-3 border-t border-gray-200'>
        <div className='flex items-end gap-2'>
          {/* 清空按钮 */}
          <button
            onClick={onClearMessages}
            title={t('清空对话')}
            className='flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-ui-text-3 hover:text-red-500 hover:bg-red-50 transition-colors'
          >
            <Trash2 size={15} />
          </button>

          {/* 输入框 */}
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={t('请输入您的问题...')}
            rows={1}
            className='flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent bg-[#fafafa]'
            style={{ maxHeight: '120px', overflowY: 'auto' }}
            disabled={isGenerating}
          />

          {/* 停止/发送按钮 */}
          {isGenerating ? (
            <button
              onClick={onStopGenerator}
              className='flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-red-500 text-white hover:bg-red-600 transition-colors'
            >
              <Square size={14} fill='white' />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!inputValue.trim()}
              className='flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-black text-white hover:bg-[#333] transition-colors disabled:opacity-40'
            >
              <Send size={15} />
            </button>
          )}
        </div>
        <p className='text-xs text-ui-text-3 mt-1.5 ml-10'>Enter 发送 · Shift+Enter 换行 · Ctrl+V 粘贴图片</p>
      </div>
    </div>
  );
};

export default ChatArea;

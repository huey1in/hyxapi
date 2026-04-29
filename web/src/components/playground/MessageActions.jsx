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
import { RefreshCw, Copy, Trash2, UserCheck, Edit } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const IconBtn = ({ title, onClick, disabled, children, className = '' }) => (
  <button
    title={title}
    onClick={onClick}
    disabled={disabled}
    className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${className}`}
  >
    {children}
  </button>
);

const MessageActions = ({
  message,
  styleState,
  onMessageReset,
  onMessageCopy,
  onMessageDelete,
  onRoleToggle,
  onMessageEdit,
  isAnyMessageGenerating = false,
  isEditing = false,
}) => {
  const { t } = useTranslation();
  const sz = styleState.isMobile ? 12 : 14;
  const isLoading = message.status === 'loading' || message.status === 'incomplete';
  const shouldDisableActions = isAnyMessageGenerating || isEditing;
  const canToggleRole = message.role === 'assistant' || message.role === 'system';
  const canEdit = !isLoading && message.content && typeof onMessageEdit === 'function' && !isEditing;

  return (
    <div className='flex items-center gap-0.5'>
      {!isLoading && (
        <IconBtn
          title={shouldDisableActions ? t('操作暂时被禁用') : t('重试')}
          onClick={() => !shouldDisableActions && onMessageReset(message)}
          disabled={shouldDisableActions}
          className='text-gray-400 hover:text-blue-600 hover:bg-blue-50'
        >
          <RefreshCw size={sz} />
        </IconBtn>
      )}

      {message.content && (
        <IconBtn
          title={t('复制')}
          onClick={() => onMessageCopy(message)}
          className='text-gray-400 hover:text-green-600 hover:bg-green-50'
        >
          <Copy size={sz} />
        </IconBtn>
      )}

      {canEdit && (
        <IconBtn
          title={shouldDisableActions ? t('操作暂时被禁用') : t('编辑')}
          onClick={() => !shouldDisableActions && onMessageEdit(message)}
          disabled={shouldDisableActions}
          className='text-gray-400 hover:text-yellow-600 hover:bg-yellow-50'
        >
          <Edit size={sz} />
        </IconBtn>
      )}

      {canToggleRole && !isLoading && (
        <IconBtn
          title={shouldDisableActions ? t('操作暂时被禁用') : message.role === 'assistant' ? t('切换为System角色') : t('切换为Assistant角色')}
          onClick={() => !shouldDisableActions && onRoleToggle && onRoleToggle(message)}
          disabled={shouldDisableActions}
          className={message.role === 'system' ? 'text-purple-500 hover:text-purple-700 hover:bg-purple-50' : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'}
        >
          <UserCheck size={sz} />
        </IconBtn>
      )}

      {!isLoading && (
        <IconBtn
          title={shouldDisableActions ? t('操作暂时被禁用') : t('删除')}
          onClick={() => !shouldDisableActions && onMessageDelete(message)}
          disabled={shouldDisableActions}
          className='text-gray-400 hover:text-red-600 hover:bg-red-50'
        >
          <Trash2 size={sz} />
        </IconBtn>
      )}
    </div>
  );
};

export default MessageActions;

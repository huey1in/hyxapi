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
import { IconButton } from '../ui';

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
  const size = styleState.isMobile ? 'xs' : 'sm';
  const isLoading = message.status === 'loading' || message.status === 'incomplete';
  const shouldDisableActions = isAnyMessageGenerating || isEditing;
  const canToggleRole = message.role === 'assistant' || message.role === 'system';
  const canEdit = !isLoading && message.content && typeof onMessageEdit === 'function' && !isEditing;

  return (
    <div className='flex items-center gap-0.5'>
      {!isLoading && (
        <IconButton
          icon={RefreshCw}
          size={size}
          shape='circle'
          tone='blue'
          title={shouldDisableActions ? t('操作暂时被禁用') : t('重试')}
          onClick={() => !shouldDisableActions && onMessageReset(message)}
          disabled={shouldDisableActions}
        />
      )}

      {message.content && (
        <IconButton
          icon={Copy}
          size={size}
          shape='circle'
          tone='green'
          title={t('复制')}
          onClick={() => onMessageCopy(message)}
        />
      )}

      {canEdit && (
        <IconButton
          icon={Edit}
          size={size}
          shape='circle'
          tone='yellow'
          title={shouldDisableActions ? t('操作暂时被禁用') : t('编辑')}
          onClick={() => !shouldDisableActions && onMessageEdit(message)}
          disabled={shouldDisableActions}
        />
      )}

      {canToggleRole && !isLoading && (
        <IconButton
          icon={UserCheck}
          size={size}
          shape='circle'
          tone='purple'
          selected={message.role === 'system'}
          title={shouldDisableActions ? t('操作暂时被禁用') : message.role === 'assistant' ? t('切换为System角色') : t('切换为Assistant角色')}
          onClick={() => !shouldDisableActions && onRoleToggle && onRoleToggle(message)}
          disabled={shouldDisableActions}
        />
      )}

      {!isLoading && (
        <IconButton
          icon={Trash2}
          size={size}
          shape='circle'
          tone='red'
          title={shouldDisableActions ? t('操作暂时被禁用') : t('删除')}
          onClick={() => !shouldDisableActions && onMessageDelete(message)}
          disabled={shouldDisableActions}
        />
      )}
    </div>
  );
};

export default MessageActions;

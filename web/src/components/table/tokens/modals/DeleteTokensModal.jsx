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
import ModalDialog from '../../../common/ModalDialog';

const DeleteTokensModal = ({
  visible,
  onCancel,
  onConfirm,
  selectedKeys,
  t,
}) => {
  return (
    <ModalDialog
      open={visible}
      onClose={onCancel}
      title={t('批量删除令牌')}
      footer={
        <>
          <button
            onClick={onCancel}
            className='px-4 py-2 text-sm font-medium rounded-xl border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors'
          >
            {t('取消')}
          </button>
          <button
            onClick={onConfirm}
            className='px-4 py-2 text-sm font-semibold rounded-xl bg-ui-danger text-white hover:opacity-90 transition-colors'
          >
            {t('确定')}
          </button>
        </>
      }
    >
      <div>
        {t('确定要删除所选的 {{count}} 个令牌吗？', {
          count: selectedKeys.length,
        })}
      </div>
    </ModalDialog>
  );
};

export default DeleteTokensModal;

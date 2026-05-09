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

const CopyTokensModal = ({
  visible,
  onCancel,
  batchCopyTokens,
  t,
}) => {
  // Handle copy with name and key format
  const handleCopyWithName = async () => {
    await batchCopyTokens('name+key');
    onCancel();
  };

  // Handle copy with key only format
  const handleCopyKeyOnly = async () => {
    await batchCopyTokens('key-only');
    onCancel();
  };

  return (
    <ModalDialog
      open={visible}
      onClose={onCancel}
      title={t('复制令牌')}
      footer={
        <>
          <button
            onClick={handleCopyWithName}
            className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors'
          >
            {t('名称+密钥')}
          </button>
          <button
            onClick={handleCopyKeyOnly}
            className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover transition-colors'
          >
            {t('仅密钥')}
          </button>
        </>
      }
    >
      {t('请选择你的复制方式')}
    </ModalDialog>
  );
};

export default CopyTokensModal;

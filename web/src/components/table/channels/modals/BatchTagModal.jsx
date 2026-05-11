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
import { TextField } from '../../../common/form/Primitives';
import { Button } from '../../../ui';

const BatchTagModal = ({
  showBatchSetTag,
  setShowBatchSetTag,
  batchSetChannelTag,
  batchSetTagValue,
  setBatchSetTagValue,
  selectedChannels,
  t,
}) => {
  const onCancel = () => setShowBatchSetTag(false);
  return (
    <ModalDialog
      open={showBatchSetTag}
      onClose={onCancel}
      title={t('批量设置标签')}
      width={460}
      footer={
        <>
          <Button variant='secondary' onClick={onCancel}>
            {t('取消')}
          </Button>
          <Button onClick={batchSetChannelTag}>
            {t('确定')}
          </Button>
        </>
      }
    >
      <div className='mb-2'>
        <span className='text-sm text-ui-text'>
          {t('请输入要设置的标签名称')}
        </span>
      </div>
      <TextField
        placeholder={t('请输入标签名称')}
        value={batchSetTagValue}
        onChange={(v) => setBatchSetTagValue(v)}
      />
      <div className='mt-2'>
        <span className='text-xs text-ui-text-3'>
          {t('已选择 ${count} 个渠道').replace(
            '${count}',
            selectedChannels.length,
          )}
        </span>
      </div>
    </ModalDialog>
  );
};

export default BatchTagModal;

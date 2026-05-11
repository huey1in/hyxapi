/* BatchTagModal — 与 web-backup 同构 */

import React from 'react';
import { Modal, Input, Button } from '../../../ui';

const BatchTagModal = ({
  showBatchSetTag, setShowBatchSetTag, batchSetChannelTag,
  batchSetTagValue, setBatchSetTagValue, selectedChannels, t,
}) => {
  const onCancel = () => setShowBatchSetTag(false);
  return (
    <Modal
      open={!!showBatchSetTag}
      onClose={onCancel}
      title={t('批量设置标签')}
      width={460}
      footer={
        <>
          <Button variant='toggle' onClick={onCancel}>{t('取消')}</Button>
          <Button onClick={batchSetChannelTag}>{t('确定')}</Button>
        </>
      }
    >
      <div className='mb-2'>
        <span className='text-sm text-ui-text'>{t('请输入要设置的标签名称')}</span>
      </div>
      <Input placeholder={t('请输入标签名称')} value={batchSetTagValue} onChange={setBatchSetTagValue} />
      <div className='mt-2'>
        <span className='text-xs text-ui-text-3'>
          {t('已选择 ${count} 个渠道').replace('${count}', selectedChannels?.length || 0)}
        </span>
      </div>
    </Modal>
  );
};

export default BatchTagModal;

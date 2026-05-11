/*
 * UserSubscriptionsModal — 用户订阅管理（管理员）
 *
 * TODO: 完整版需要拉用户订阅列表 + 添加/取消订阅 + 切换套餐。
 * 当前阶段仅占位，能打开/关闭以保证父组件链路通顺。
 */

import React from 'react';
import { SlideOver, Notice } from '../../../ui';

const UserSubscriptionsModal = ({ visible, onCancel, user, t = (s) => s }) => (
  <SlideOver
    open={!!visible}
    onClose={onCancel}
    placement='right'
    width={520}
    title={<span className='text-base font-semibold text-ui-text'>{t('订阅管理')}{user ? ` · ${user.username}` : ''}</span>}
  >
    <div className='p-5'>
      <Notice kind='info' title={t('待补充')}>
        {t('该用户的订阅明细 / 添加 / 取消 / 切换套餐功能尚未接入。')}
      </Notice>
    </div>
  </SlideOver>
);

export default UserSubscriptionsModal;

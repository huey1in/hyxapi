/*
 * SubscriptionCodesModal — 套餐兑换码批量生成/查看
 *
 * TODO: 完整版需要展示已生成兑换码列表 + 批量生成 + 复制全部。
 * 当前阶段占位。
 */

import React from 'react';
import { Modal, Notice } from '../../../ui';

const SubscriptionCodesModal = ({ visible, plan, onClose, t = (s) => s }) => (
  <Modal open={!!visible} onClose={onClose} title={`${t('兑换码')}${plan?.plan ? ` · ${plan.plan.title}` : ''}`} width={520} hideFooter>
    <Notice kind='info' title={t('待补充')}>
      {t('兑换码列表 / 批量生成 / 复制全部功能尚未接入。')}
    </Notice>
  </Modal>
);

export default SubscriptionCodesModal;

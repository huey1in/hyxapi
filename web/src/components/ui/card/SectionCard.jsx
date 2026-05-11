/*
 * SectionCard — 设置页/详情页常用的小节卡片
 *
 * title:       string
 * description: 副标题
 * children:    section 内容
 *
 * 实质是 Card variant='plain' 的语义封装。
 */

import React from 'react';
import Card from './Card';

const SectionCard = ({ title, description, children }) => (
  <Card variant='plain'>
    {(title || description) && (
      <div className='mb-4'>
        {title && <div className='text-sm font-semibold text-ui-text'>{title}</div>}
        {description && <div className='text-[11px] text-ui-text-3 mt-0.5'>{description}</div>}
      </div>
    )}
    <div className='space-y-3'>{children}</div>
  </Card>
);

export default SectionCard;

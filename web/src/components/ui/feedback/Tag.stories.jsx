import React from 'react';
import Tag from './Tag';

export default { title: 'UI/Tag', component: Tag };

export const AllVariants = () => (
  <div className='space-y-3'>
    <div>
      <div className='text-[11px] uppercase tracking-wider text-ui-text-3 mb-2'>color</div>
      <div className='flex flex-wrap gap-2'>
        <Tag>default</Tag>
        <Tag color='blue'>blue</Tag>
        <Tag color='emerald'>emerald</Tag>
        <Tag color='violet'>violet</Tag>
        <Tag color='amber'>amber</Tag>
        <Tag color='rose'>rose</Tag>
        <Tag color='cyan'>cyan</Tag>
        <Tag color='danger'>danger</Tag>
        <Tag color='success'>success</Tag>
        <Tag color='warning'>warning</Tag>
      </div>
    </div>
    <div>
      <div className='text-[11px] uppercase tracking-wider text-ui-text-3 mb-2'>dot</div>
      <div className='flex flex-wrap gap-3'>
        <Tag dot color='emerald'>生效</Tag>
        <Tag dot color='rose'>已禁用</Tag>
        <Tag dot color='amber'>待审核</Tag>
        <Tag dot>未使用</Tag>
      </div>
    </div>
    <div>
      <div className='text-[11px] uppercase tracking-wider text-ui-text-3 mb-2'>closable</div>
      <div className='flex flex-wrap gap-2'>
        <Tag color='blue' closable onClose={() => alert('close')}>关闭我</Tag>
      </div>
    </div>
  </div>
);

import React, { useState } from 'react';
import Accordion from './Accordion';

export default { title: 'UI/Accordion', component: Accordion };

const items = [
  { key: 'a', title: '账号设置在哪里？', content: '点击右上角头像 → 设置，即可进入账号管理页面修改密码、邮箱、绑定等。' },
  { key: 'b', title: '如何创建 API Key？', content: 'API 页面右上角点击「创建 API key」，系统会生成一个 sk- 前缀的 token；请妥善保存，关闭后无法再次查看。' },
  { key: 'c', title: '支持哪些支付方式？', content: '支持 Apple Pay / Google Pay / 信用卡，以及部分地区的支付宝、微信。' },
  { key: 'd', title: '订阅可以随时取消吗？', content: '可以。订阅页 → 当前订阅 → 取消。已支付费用不退还，订阅期内继续生效。' },
];

export const Single = () => (
  <div className='max-w-[640px]'>
    <Accordion items={items} defaultActiveKey='a' />
  </div>
);

export const Multiple = () => (
  <div className='max-w-[640px]'>
    <Accordion items={items} multiple defaultActiveKey={['a', 'c']} />
  </div>
);

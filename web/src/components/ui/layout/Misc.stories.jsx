import React, { useState } from 'react';
import Breadcrumb from './Breadcrumb';
import Steps from './Steps';
import Slider from '../input/Slider';
import Button from '../button/Button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default { title: 'UI/Misc' };

const Row = ({ title, children }) => (
  <div className='mb-6'>
    <div className='text-[11px] uppercase tracking-wider text-ui-text-3 mb-2'>{title}</div>
    {children}
  </div>
);

export const Breadcrumbs = () => (
  <div className='space-y-3 max-w-[700px]'>
    <Breadcrumb items={[
      { label: '首页', href: '#' },
      { label: '账单', href: '#' },
      { label: '订单详情' },
    ]} />
    <Breadcrumb items={[
      { label: '工作区', onClick: () => alert('go') },
      { label: '项目 A', onClick: () => alert('go') },
      { label: '设置' },
    ]} />
  </div>
);

export const StepsDemo = () => {
  const [cur, setCur] = useState(1);
  const items = [
    { title: '填写基本信息', description: '名称、套餐' },
    { title: '配置规则',    description: '价格、权限' },
    { title: '审核确认',    description: '提交审核' },
    { title: '完成' },
  ];
  return (
    <div className='space-y-6 max-w-[700px]'>
      <Row title='horizontal'>
        <Steps items={items} current={cur} />
        <div className='flex items-center gap-2 mt-4'>
          <Button icon={ChevronLeft} onClick={() => setCur(Math.max(0, cur - 1))}>上一步</Button>
          <Button iconRight={ChevronRight} onClick={() => setCur(Math.min(items.length - 1, cur + 1))}>下一步</Button>
        </div>
      </Row>
      <Row title='vertical'>
        <Steps direction='vertical' items={items} current={cur} />
      </Row>
    </div>
  );
};

export const SliderDemo = () => {
  const [v, setV] = useState(40);
  return (
    <div className='space-y-3 max-w-[500px]'>
      <Slider value={v} onChange={setV} showLabel width='full' />
      <Slider value={v} onChange={setV} min={0} max={10} step={1} showLabel />
      <Slider value={80} disabled showLabel />
    </div>
  );
};

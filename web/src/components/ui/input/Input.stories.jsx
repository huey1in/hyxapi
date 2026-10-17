import { useState } from 'react';
import { Search } from 'lucide-react';
import Input, { inputStyle } from './Input';
import FieldRow from './FieldRow';

export default { title: 'UI/Input', component: Input };

const Row = ({ title, children }) => (
  <div className='mb-5'>
    <div className='text-[11px] uppercase tracking-wider text-ui-text-3 mb-2'>{title}</div>
    {children}
  </div>
);

export const AllVariants = () => {
  const [v1, setV1] = useState('');
  const [v2, setV2] = useState('clear me');
  const ts = inputStyle({ variant: 'admin', size: 36 });
  return (
    <div className='max-w-[600px] space-y-3'>
      <Row title='variant'>
        <div className='space-y-2'>
          <Input variant='admin' value={v1} onChange={setV1} placeholder='admin (默认 rounded-xl)' />
          <Input variant='inline' value={v1} onChange={setV1} placeholder='inline (rounded-sm + bg-subtle)' />
        </div>
      </Row>
      <Row title='size (数值，控制高度 + 字号)'>
        <div className='space-y-2'>
          <Input size={28} placeholder='size=28 → 字号 12' />
          <Input size={36} placeholder='size=36 (默认) → 字号 14' />
          <Input size={44} placeholder='size=44 → 字号 16' />
        </div>
      </Row>
      <Row title='prefix / suffix'>
        <div className='space-y-2'>
          <Input prefix={<Search size={14} />} placeholder='搜索...' />
          <Input suffix={<span className='text-xs'>USD</span>} placeholder='99.00' />
        </div>
      </Row>
      <Row title='clearable'>
        <Input clearable value={v2} onChange={setV2} placeholder='输入后可清除' />
      </Row>
      <Row title='invalid / disabled'>
        <div className='space-y-2'>
          <Input invalid value='错误状态' onChange={() => {}} />
          <Input disabled placeholder='禁用' />
        </div>
      </Row>
      <Row title='FieldRow 包装'>
        <FieldRow label='套餐名称' required hint='1-20 个字符'>
          <Input placeholder='输入名称' />
        </FieldRow>
      </Row>
      <Row title='inputStyle() — 用于自定义/原生元素'>
        <textarea
          rows={3}
          className={ts.className + ' resize-none'}
          style={{ ...ts.style, height: undefined, paddingTop: 8, paddingBottom: 8 }}
          placeholder='这是原生 textarea，复用 input 样式'
        />
      </Row>
    </div>
  );
};

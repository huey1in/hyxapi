import { Plus, Search, ArrowRight, Save } from 'lucide-react';
import Button from './Button';

export default {
  title: 'UI/Button',
  component: Button,
  parameters: { layout: 'centered' },
};

const Row = ({ title, children }) => (
  <div className='mb-4'>
    <div className='text-[11px] uppercase tracking-wider text-ui-text-3 mb-2'>{title}</div>
    <div className='flex flex-wrap items-center gap-2'>{children}</div>
  </div>
);

export const AllVariants = () => (
  <div className='min-w-[600px] space-y-2'>
    <Row title='variant'>
      <Button>primary</Button>
    </Row>

    <Row title='size (sm 改用 rounded-md)'>
      <Button size='sm'>sm</Button>
      <Button size='md'>md</Button>
      <Button size='lg'>lg</Button>
    </Row>

    <Row title='with icon'>
      <Button icon={Plus}>添加</Button>
      <Button icon={Save}>保存</Button>
      <Button icon={Search}>搜索</Button>
      <Button iconRight={ArrowRight}>下一步</Button>
    </Row>

    <Row title='loading / disabled'>
      <Button loading>提交中</Button>
      <Button disabled>已禁用</Button>
    </Row>

    <Row title='toggle (stateful)'>
      <Button variant='toggle' selected>表格视图</Button>
      <Button variant='toggle'>卡片视图</Button>
    </Row>

    <Row title='chip (stateful, 胶囊)'>
      <Button variant='chip' selected size='sm'>已选</Button>
      <Button variant='chip' size='sm'>未选</Button>
    </Row>

    <Row title='block (占满父宽)'>
      <div className='w-[300px]'>
        <Button block icon={Plus}>添加渠道</Button>
      </div>
    </Row>

    <Row title='flex1 (flex 行内平分)'>
      <div className='flex gap-2 w-[300px]'>
        <Button flex1>取消</Button>
        <Button flex1>确认</Button>
      </div>
    </Row>

    <Row title='justify=start (左对齐，菜单项)'>
      <div className='w-[200px]'>
        <Button block justify='start'>账户设置</Button>
      </div>
      <div className='w-[200px]'>
        <Button block justify='start' icon={Plus}>添加项</Button>
      </div>
    </Row>
  </div>
);

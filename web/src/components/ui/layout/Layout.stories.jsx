import React, { useState } from 'react';
import { RefreshCw, Plus, Inbox } from 'lucide-react';
import PageShell from './PageShell';
import SectionCard from '../card/SectionCard';
import EmptyState from '../display/EmptyState';
import Tabs from './Tabs';
import Pagination from './Pagination';
import Notice from '../feedback/Notice';
import Divider from '../display/Divider';
import Loading from '../feedback/Loading';
import Skeleton from '../feedback/Skeleton';
import Tooltip from '../feedback/Tooltip';
import Button from '../button/Button';
import IconButton from '../button/IconButton';

export default { title: 'UI/Layout & Misc' };

const Row = ({ title, children }) => (
  <div className='mb-5'>
    <div className='text-[11px] uppercase tracking-wider text-ui-text-3 mb-2'>{title}</div>
    {children}
  </div>
);

export const PageShellDemo = () => (
  <PageShell
    title='页面标题'
    actions={
      <>
        <IconButton icon={RefreshCw} title='刷新' />
        <Button icon={Plus}>新建</Button>
      </>
    }
  >
    <Notice>这是一个 Notice 横幅。</Notice>
    <div className='h-2' />
    <SectionCard title='区块标题' description='副标题描述文本'>
      <div className='text-sm text-ui-text-2'>SectionCard 是设置页常用的小节卡片，variant=plain。</div>
    </SectionCard>
  </PageShell>
);

export const TabsDemo = () => {
  const [v, setV] = useState('a');
  const items = [
    { value: 'a', label: '订单' },
    { value: 'b', label: '订阅' },
    { value: 'c', label: '统计' },
  ];
  return <Tabs items={items} value={v} onChange={setV} />;
};

export const PaginationDemo = () => {
  const [page, setPage] = useState(1);
  return (
    <div className='border border-ui-border rounded-2xl overflow-hidden bg-[var(--page-bg)] max-w-[480px]'>
      <div className='p-6 text-sm text-ui-text-2'>这里是表格内容...</div>
      <Pagination page={page} pageSize={20} total={185} onChange={setPage} />
    </div>
  );
};

export const NoticeAndDivider = () => (
  <div className='space-y-3 max-w-[600px]'>
    <Notice kind='info' title='提示'>Info 横幅文案。</Notice>
    <Notice kind='success'>操作成功，已应用变更。</Notice>
    <Notice kind='warning' title='警告'>请确认后再继续操作。</Notice>
    <Notice kind='danger'>删除后不可恢复！</Notice>
    <Divider />
    <Notice
      action={<Button size='sm'>查看</Button>}
    >
      Notice 也支持右侧 action 节点。
    </Notice>
  </div>
);

export const LoadingAndSkeleton = () => (
  <div className='space-y-5'>
    <Row title='Loading (xs/sm/md/lg)'>
      <div className='flex items-center gap-6'>
        <Loading size='xs' />
        <Loading size='sm' />
        <Loading size='md' label='加载中' />
        <Loading size='lg' />
      </div>
    </Row>
    <Row title='Skeleton'>
      <div className='max-w-[400px] space-y-2'>
        <Skeleton width='40%' height='14px' />
        <Skeleton width='100%' height='12px' count={3} />
        <Skeleton shape='circle' width='40px' />
      </div>
    </Row>
  </div>
);

export const TooltipDemo = () => (
  <div className='flex items-center gap-8 p-12'>
    <Tooltip content='这是顶部 tooltip'>
      <Button>hover 试试</Button>
    </Tooltip>
    <Tooltip placement='right' content='右侧'>
      <Button>right</Button>
    </Tooltip>
    <Tooltip placement='bottom' content='底部'>
      <Button>bottom</Button>
    </Tooltip>
  </div>
);

export const EmptyStateDemo = () => (
  <div className='max-w-[600px] border border-ui-border rounded-2xl'>
    <EmptyState
      icon={Inbox}
      title='暂无数据'
      description='点击下面的按钮创建第一个条目'
      action={<Button icon={Plus} size='sm'>新建</Button>}
    />
  </div>
);

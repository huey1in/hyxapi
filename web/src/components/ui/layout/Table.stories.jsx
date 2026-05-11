import React, { useState } from 'react';
import Table from './Table';
import Tag from '../feedback/Tag';
import IconButton from '../button/IconButton';
import { Trash2, Pencil } from 'lucide-react';

export default { title: 'UI/Table', component: Table };

const Row = ({ title, children }) => (
  <div className='mb-6'>
    <div className='text-[11px] uppercase tracking-wider text-ui-text-3 mb-2'>{title}</div>
    {children}
  </div>
);

const sampleRows = [
  { id: 1, name: 'Pro 套餐',  price: 99,  status: 'active',   created: '2026-01-12' },
  { id: 2, name: 'Lite 套餐', price: 29,  status: 'active',   created: '2026-02-03' },
  { id: 3, name: '试用套餐',  price: 0,   status: 'inactive', created: '2026-03-18' },
  { id: 4, name: '企业定制',  price: 599, status: 'active',   created: '2026-04-22' },
];

const STATUS_TONE = { active: 'emerald', inactive: 'default' };
const STATUS_LABEL = { active: '启用', inactive: '停用' };

export const Default = () => {
  const [picked, setPicked] = useState(null);
  const columns = [
    { key: 'name',    title: '名称' },
    { key: 'price',   title: '价格',  align: 'right', width: 100, render: (r) => `¥ ${r.price}` },
    {
      key: 'status',  title: '状态', width: 120,
      render: (r) => <Tag color={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Tag>,
    },
    { key: 'created', title: '创建时间', width: 140 },
    {
      key: 'op', title: '操作', align: 'right', width: 100,
      render: (r) => (
        <div className='inline-flex items-center gap-1'>
          <IconButton icon={Pencil} size='sm' onClick={(e) => { e.stopPropagation(); alert(`编辑 ${r.name}`); }} />
          <IconButton icon={Trash2} size='sm' variant='danger' onClick={(e) => { e.stopPropagation(); alert(`删除 ${r.name}`); }} />
        </div>
      ),
    },
  ];

  return (
    <div className='max-w-[900px] space-y-6'>
      <Row title='默认 (hoverable + 可点击行)'>
        <Table
          columns={columns}
          rows={sampleRows}
          onRowClick={(r) => setPicked(r)}
        />
        <div className='mt-2 text-xs text-ui-text-3'>当前选中：{picked ? picked.name : '无'}</div>
      </Row>

      <Row title='striped (隔行变色)'>
        <Table columns={columns} rows={sampleRows} striped />
      </Row>

      <Row title='size=sm'>
        <Table columns={columns} rows={sampleRows} size='sm' />
      </Row>

      <Row title='空数据'>
        <Table columns={columns} rows={[]} />
      </Row>
    </div>
  );
};

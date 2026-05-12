import React, { useContext, useEffect, useState } from 'react';
import { Filter, RefreshCw } from 'lucide-react';
import { API, showError, renderQuota, timestamp2string } from '../../helpers';
import { UserContext } from '../../context/User';
import {
  PageShell, Card, Button, IconButton, Input, Select, Table, Pagination, Tag, Modal, Loading,
} from '../../components/ui';

const PAGE_SIZE = 20;

const TYPE_LABELS = {
  1: { color: 'green',  text: '充值' },
  2: { color: 'blue',   text: '消费' },
  3: { color: 'grey',   text: '管理' },
  4: { color: 'grey',   text: '系统' },
  5: { color: 'red',    text: '错误' },
  6: { color: 'amber',  text: '退款' },
};

const TYPE_OPTIONS = [
  { value: 0, label: '全部' },
  { value: 1, label: '充值' },
  { value: 2, label: '消费' },
  { value: 3, label: '管理' },
  { value: 4, label: '系统' },
  { value: 5, label: '错误' },
  { value: 6, label: '退款' },
];

const LogPage = () => {
  const [userState] = useContext(UserContext);
  const isAdmin = (userState?.user?.role || 1) >= 10;
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [detail, setDetail] = useState(null);
  const [filters, setFilters] = useState({
    token_name: '', model_name: '', group: '', request_id: '',
    channel: '', username: '', type: 0,
  });

  const f = (k) => (v) => setFilters((p) => ({ ...p, [k]: v?.target ? v.target.value : v }));

  const load = async (p = 1, fl = filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        p: String(p), size: String(PAGE_SIZE),
        type: String(fl.type || 0),
        token_name: fl.token_name || '',
        model_name: fl.model_name || '',
        group: fl.group || '',
        request_id: fl.request_id || '',
        start_timestamp: '0', end_timestamp: '0',
      });
      if (isAdmin) {
        if (fl.channel) params.append('channel', fl.channel);
        if (fl.username) params.append('username', fl.username);
      }
      const url = (isAdmin ? '/api/log/?' : '/api/log/self/?') + params.toString();
      const { data } = await API.get(url);
      if (data.success) {
        setRows(data.data.items || []);
        setTotal(data.data.total || 0);
        setPage(data.data.page || p);
      } else showError(data.message);
    } catch (e) { showError(e); } finally { setLoading(false); }
  };
  useEffect(() => { load(1); }, []);

  const reset = () => {
    const empty = { token_name: '', model_name: '', group: '', request_id: '', channel: '', username: '', type: 0 };
    setFilters(empty); load(1, empty);
  };

  const columns = [
    { key: 'created_at', title: '时间', render: (r) => timestamp2string(r.created_at) },
    { key: 'type', title: '类型', render: (r) => {
        const t = TYPE_LABELS[r.type] || TYPE_LABELS[3];
        return <Tag color={t.color}>{t.text}</Tag>;
      } },
    { key: 'model_name', title: '模型', render: (r) => r.model_name || '-' },
    { key: 'token_used', title: 'Tokens', render: (r) => (r.prompt_tokens || 0) + (r.completion_tokens || 0) || '-' },
    ...(isAdmin ? [
      { key: 'username', title: '用户', render: (r) => r.username || '-' },
      { key: 'channel', title: '渠道', render: (r) => r.channel || '-' },
    ] : []),
    { key: 'quota', title: '消耗', render: (r) => r.quota > 0 ? renderQuota(r.quota, 4) : '-' },
    { key: 'use_time', title: '用时', render: (r) => r.use_time ? `${r.use_time}s` : '-' },
  ];

  return (
    <PageShell
      title='日志'
      actions={
        <>
          <IconButton icon={Filter} title='筛选' selected={showFilters} onClick={() => setShowFilters((s) => !s)} />
          <IconButton icon={RefreshCw} title='刷新' onClick={() => load(page)} />
        </>
      }
    >
      {showFilters && (
        <Card className='mb-4'>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
            <div>
              <label className='block text-xs text-ui-text-2 mb-1'>类型</label>
              <Select value={filters.type} onChange={(v) => f('type')(Number(v))} options={TYPE_OPTIONS} />
            </div>
            <div>
              <label className='block text-xs text-ui-text-2 mb-1'>令牌名</label>
              <Input value={filters.token_name} onChange={f('token_name')} />
            </div>
            <div>
              <label className='block text-xs text-ui-text-2 mb-1'>模型</label>
              <Input value={filters.model_name} onChange={f('model_name')} />
            </div>
            <div>
              <label className='block text-xs text-ui-text-2 mb-1'>分组</label>
              <Input value={filters.group} onChange={f('group')} />
            </div>
            {isAdmin && (
              <>
                <div>
                  <label className='block text-xs text-ui-text-2 mb-1'>渠道</label>
                  <Input value={filters.channel} onChange={f('channel')} />
                </div>
                <div>
                  <label className='block text-xs text-ui-text-2 mb-1'>用户名</label>
                  <Input value={filters.username} onChange={f('username')} />
                </div>
              </>
            )}
            <div>
              <label className='block text-xs text-ui-text-2 mb-1'>Request ID</label>
              <Input value={filters.request_id} onChange={f('request_id')} />
            </div>
          </div>
          <div className='flex justify-end gap-2 mt-4'>
            <Button variant='toggle' onClick={reset}>重置</Button>
            <Button onClick={() => load(1)}>搜索</Button>
          </div>
        </Card>
      )}

      {loading ? <Loading /> : (
        <>
          <Table columns={columns} rows={rows} size='sm' onRowClick={(r) => setDetail(r)} />
          <div className='mt-4 flex justify-end'>
            <Pagination total={total} pageSize={PAGE_SIZE} page={page} onChange={(p) => load(p)} />
          </div>
        </>
      )}

      {detail && (
        <Modal open title={`日志 #${detail.id} 详情`} onClose={() => setDetail(null)} hideFooter width={640}>
          <div className='space-y-3 text-sm'>
            <Row label='时间' value={timestamp2string(detail.created_at)} />
            <Row label='类型' value={<Tag color={(TYPE_LABELS[detail.type] || TYPE_LABELS[3]).color}>{(TYPE_LABELS[detail.type] || TYPE_LABELS[3]).text}</Tag>} />
            <Row label='模型' value={detail.model_name || '-'} />
            {isAdmin && <Row label='用户' value={detail.username || '-'} />}
            {isAdmin && <Row label='渠道' value={detail.channel ?? '-'} />}
            <Row label='Token 用量' value={`${detail.prompt_tokens || 0} → ${detail.completion_tokens || 0}`} />
            <Row label='消耗' value={detail.quota > 0 ? renderQuota(detail.quota, 4) : '-'} />
            <Row label='用时' value={detail.use_time ? `${detail.use_time}s` : '-'} />
            <Row label='Request ID' value={detail.request_id || '-'} mono />
            <Row label='IP' value={detail.ip || '-'} mono />
            <Row label='UA' value={detail.user_agent || '-'} mono />
            <Row label='Content' value={detail.content || '-'} multiline />
            <div className='flex justify-end'>
              <Button onClick={() => setDetail(null)}>关闭</Button>
            </div>
          </div>
        </Modal>
      )}
    </PageShell>
  );
};

const Row = ({ label, value, mono, multiline }) => (
  <div className='grid grid-cols-[100px_1fr] gap-3 items-start'>
    <span className='text-ui-text-3 text-xs uppercase tracking-wide pt-0.5'>{label}</span>
    <span className={`text-ui-text-1 ${mono ? 'font-mono text-xs' : ''} ${multiline ? 'whitespace-pre-wrap break-all' : ''}`}>{value}</span>
  </div>
);

export default LogPage;

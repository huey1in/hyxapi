import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Filter, RefreshCw } from 'lucide-react';
import { API, showError, timestamp2string } from '../../helpers';
import { Button, IconButton, Input, Pagination, Loading, Table } from '../../components/ui';
import useIsMobile from '../../hooks/useIsMobile';

const PAGE_SIZE = 20;

const ACTION_LABELS = {
  create: '创建', update: '修改', delete: '删除', enable: '启用', disable: '禁用',
};

const ACTION_COLORS = {
  create: '#22c55e', update: '#3b82f6', delete: '#ef4444', enable: '#22c55e', disable: '#f59e0b',
};

const ActionBadge = ({ action }) => {
  const color = ACTION_COLORS[action] || '#999';
  const label = ACTION_LABELS[action] || action || '—';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: 'var(--ui-text)' }}>{label}</span>
    </span>
  );
};

const RESOURCE_LABELS = {
  channel: '渠道', user: '用户', setting: '设置', subscription: '订阅',
  user_subscription: '用户订阅', redemption: '兑换码', topup: '充值',
};

const AuditLog = () => {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const isMobile = useIsMobile();
  const [filters, setFilters] = useState({ username: '', keyword: '' });
  const filtersRef = useRef(filters);
  useEffect(() => { filtersRef.current = filters; }, [filters]);

  const f = (k) => (v) => setFilters((p) => ({ ...p, [k]: v?.target ? v.target.value : v }));

  const load = async (p = 1, fl = filters, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({
        p: String(p), page_size: String(PAGE_SIZE),
        start_timestamp: '0', end_timestamp: '0',
        username: fl.username || '',
        keyword: fl.keyword || '',
      });
      const { data } = await API.get('/api/audit?' + params.toString());
      if (data.success) {
        const items = (data.data?.items || []).map((r) => {
          let other = null;
          try { if (r.other) other = typeof r.other === 'string' ? JSON.parse(r.other) : r.other; } catch {}
          return { ...r, _other: other };
        });
        setRows(items);
        setTotal(data.data?.total || 0);
        setPage(data.data?.page || p);
      } else if (!silent) showError(data.message);
    } catch (e) { if (!silent) showError(e); } finally { if (!silent) setLoading(false); }
  };
  useEffect(() => { load(1); }, []);

  const reset = () => {
    const empty = { username: '', keyword: '' };
    setFilters(empty);
    load(1, empty);
  };

  const columns = useMemo(() => {
    if (isMobile) {
      return [
        { key: 'time', title: '时间', render: (r) => <span style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--ui-text-2)' }}>{timestamp2string(r.created_at)}</span> },
        { key: 'action', title: '操作', render: (r) => <ActionBadge action={r._other?.action} /> },
        { key: 'content', title: '详情', render: (r) => <span style={{ maxWidth: 200, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }} title={r.content}>{r.content || '—'}</span> },
      ];
    }
    return [
      { key: 'time', title: '时间', render: (r) => <span style={{ whiteSpace: 'nowrap', color: 'var(--ui-text-2)' }}>{timestamp2string(r.created_at)}</span> },
      { key: 'admin', title: '管理员', render: (r) => <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{r.username || '—'}</span> },
      { key: 'action', title: '操作', render: (r) => <ActionBadge action={r._other?.action} /> },
      { key: 'resource', title: '资源', render: (r) => {
        const rt = r._other?.resource_type;
        return <span style={{ whiteSpace: 'nowrap', color: 'var(--ui-text-2)' }}>{RESOURCE_LABELS[rt] || rt || '—'}</span>;
      } },
      { key: 'content', title: '详情', render: (r) => <span style={{ maxWidth: 300, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }} title={r.content}>{r.content || '—'}</span> },
      { key: 'ip', title: 'IP', render: (r) => <span style={{ whiteSpace: 'nowrap', color: 'var(--ui-text-3)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{r.ip || '—'}</span> },
    ];
  }, [isMobile]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 20 : 28, width: '100%', maxWidth: 960, marginInline: 'auto', padding: isMobile ? '16px' : '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--ui-text)' }}>审计日志</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <IconButton icon={Filter} title='筛选' selected={showFilters} onClick={() => setShowFilters((s) => !s)} />
          <IconButton icon={RefreshCw} title='刷新' onClick={() => load(page)} />
        </div>
      </div>

      {showFilters && (
        <div style={{ padding: 16, border: '1px solid var(--ui-border)', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>管理员</div>
              <Input value={filters.username} onChange={f('username')} width='full' />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>关键词</div>
              <Input value={filters.keyword} onChange={f('keyword')} width='full' />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant='toggle' onClick={reset}>重置</Button>
            <Button onClick={() => load(1)}>搜索</Button>
          </div>
        </div>
      )}

      {loading ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><Loading /></div> : (
        <>
          <Table
            columns={columns}
            rows={rows}
            size='md'
            rowKey='id'
            emptyText='暂无审计记录'
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Pagination total={total} pageSize={PAGE_SIZE} page={page} onChange={(p) => load(p)} />
          </div>
        </>
      )}
    </div>
  );
};

export default AuditLog;

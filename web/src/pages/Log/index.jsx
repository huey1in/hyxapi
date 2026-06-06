import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Filter, RefreshCw } from 'lucide-react';
import { API, showError, renderNumber, renderQuota, timestamp2string } from '../../helpers';
import { UserContext } from '../../context/User';
import { Button, IconButton, Input, Select, Pagination, Loading, Table } from '../../components/ui';
import useIsMobile from '../../hooks/useIsMobile';

const PAGE_SIZE = 20;

const TYPE_OPTIONS = [
  { value: 0, label: '全部' },
  { value: 1, label: '充值' },
  { value: 2, label: '消费' },
  { value: 3, label: '管理' },
  { value: 4, label: '系统' },
  { value: 5, label: '错误' },
  { value: 6, label: '退款' },
];

const TYPE_LABELS = {
  1: '充值', 2: '消费', 3: '管理', 4: '系统', 5: '错误', 6: '退款',
};

const TYPE_COLORS = {
  1: '#22c55e', 2: '#000', 3: '#3b82f6', 4: '#8b5cf6', 5: '#ef4444', 6: '#f59e0b',
};

const TypeBadge = ({ type }) => {
  const color = TYPE_COLORS[type] || '#999';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: 'var(--ui-text)' }}>{TYPE_LABELS[type] || '系统'}</span>
    </span>
  );
};

const Num = ({ value }) => (
  value > 0
    ? <span style={{ fontVariantNumeric: 'tabular-nums' }}>{renderNumber(value)}</span>
    : <span style={{ color: 'var(--ui-text-3)' }}>—</span>
);

const Quota = ({ row }) => {
  // 充值 / 退款：绿色正数；从 content 解析充值金额
  if (row.type === 1 || row.type === 6) {
    let amount = row.quota;
    if (!amount && row.content) {
      const m = row.content.match(/[＄$]\s*([\d.]+)/);
      if (m) amount = parseFloat(m[1]) * 500000;
    }
    if (amount > 0) {
      return <span style={{ color: '#22c55e', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>+{renderQuota(amount, 6)}</span>;
    }
    return <span style={{ color: 'var(--ui-text-3)' }}>—</span>;
  }
  if (row.quota > 0) {
    return <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{renderQuota(row.quota, 6)}</span>;
  }
  return <span style={{ color: 'var(--ui-text-3)' }}>—</span>;
};

const LogPage = () => {
  const [userState] = useContext(UserContext);
  const isAdmin = (userState?.user?.role || 1) >= 10;
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const isMobile = useIsMobile();
  const [filters, setFilters] = useState({
    token_name: '', model_name: '', group: '', request_id: '',
    channel: '', username: '', type: 0,
  });
  const pageRef = useRef(page);
  const filtersRef = useRef(filters);
  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { filtersRef.current = filters; }, [filters]);

  const f = (k) => (v) => setFilters((p) => ({ ...p, [k]: v?.target ? v.target.value : v }));

  const load = async (p = 1, fl = filters, silent = false) => {
    if (!silent) setLoading(true);
    setExpanded(null);
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
      } else if (!silent) showError(data.message);
    } catch (e) { if (!silent) showError(e); } finally { if (!silent) setLoading(false); }
  };
  useEffect(() => {
    load(1);
  }, []);

  const reset = () => {
    const empty = { token_name: '', model_name: '', group: '', request_id: '', channel: '', username: '', type: 0 };
    setFilters(empty); load(1, empty);
  };

  // 解析每行的 other 字段，附加缓存/总量等派生数据
  const enriched = useMemo(() => rows.map((r) => {
    let other = null;
    try { if (r.other) other = typeof r.other === 'string' ? JSON.parse(r.other) : r.other; } catch {}
    const cacheHit = other?.cache_tokens || 0;
    const cacheWrite = other?.cache_write_tokens || other?.cache_creation_tokens || 0;
    return {
      ...r,
      _other: other,
      _cacheHit: cacheHit,
      _cacheWrite: cacheWrite,
      _cache: cacheHit + cacheWrite,
      _total: (r.prompt_tokens || 0) + (r.completion_tokens || 0),
    };
  }), [rows]);

  const columns = useMemo(() => {
    if (isMobile) {
      return [
        { key: 'time', title: '时间', render: (r) => <span style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--ui-text-2)' }}>{timestamp2string(r.created_at)}</span> },
        { key: 'type', title: '类型', render: (r) => <TypeBadge type={r.type} /> },
        { key: 'model', title: '模型', render: (r) => <span style={{ whiteSpace: 'nowrap', maxWidth: 140, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'bottom' }} title={r.model_name}>{r.model_name || '—'}</span> },
        { key: 'quota', title: '积分', align: 'right', render: (r) => <Quota row={r} /> },
      ];
    }
    const cols = [
      { key: 'time', title: '时间', render: (r) => <span style={{ whiteSpace: 'nowrap', color: 'var(--ui-text-2)' }}>{timestamp2string(r.created_at)}</span> },
      { key: 'type', title: '类型', render: (r) => <TypeBadge type={r.type} /> },
      { key: 'model', title: '模型', render: (r) => <span style={{ whiteSpace: 'nowrap', maxWidth: 150, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'bottom' }} title={r.model_name}>{r.model_name || '—'}</span> },
    ];
    if (isAdmin) {
      cols.push({ key: 'username', title: '用户', render: (r) => <span style={{ whiteSpace: 'nowrap', maxWidth: 100, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'bottom' }} title={r.username}>{r.username || '—'}</span> });
    }
    cols.push(
      { key: 'token', title: '令牌', render: (r) => <span style={{ whiteSpace: 'nowrap', maxWidth: 100, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'bottom', color: 'var(--ui-text-2)' }} title={r.token_name}>{r.token_name || '—'}</span> },
      { key: 'group', title: '分组', render: (r) => <span style={{ whiteSpace: 'nowrap', color: 'var(--ui-text-2)' }}>{r.group || '—'}</span> },
      { key: 'input', title: '输入', align: 'right', render: (r) => <Num value={r.prompt_tokens || 0} /> },
      { key: 'output', title: '输出', align: 'right', render: (r) => <Num value={r.completion_tokens || 0} /> },
      { key: 'cache', title: '缓存', align: 'right', render: (r) => <Num value={r._cache} /> },
      { key: 'time_used', title: '耗时', align: 'right', render: (r) => r.use_time > 0 ? <span style={{ whiteSpace: 'nowrap', color: 'var(--ui-text-2)' }}>{r.use_time}s</span> : <span style={{ color: 'var(--ui-text-3)' }}>—</span> },
      { key: 'quota', title: '积分', align: 'right', render: (r) => <Quota row={r} /> },
    );
    return cols;
  }, [isMobile, isAdmin]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 20 : 28, width: '100%', maxWidth: 1160, marginInline: 'auto', padding: isMobile ? '16px' : '24px 16px', minWidth: 0, overflow: isMobile ? 'visible' : 'hidden' }}>
      {/* 标题 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--ui-text)' }}>消费明细</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <IconButton icon={Filter} title='筛选' selected={showFilters} onClick={() => setShowFilters((s) => !s)} />
          <IconButton icon={RefreshCw} title='刷新' onClick={() => load(page)} />
        </div>
      </div>

      {/* 筛选面板 */}
      {showFilters && (
        <div style={{ padding: 16, border: '1px solid var(--ui-border)', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>类型</div>
              <Select value={filters.type} onChange={(v) => f('type')(Number(v))} options={TYPE_OPTIONS} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>令牌名</div>
              <Input value={filters.token_name} onChange={f('token_name')} width='full' />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>模型</div>
              <Input value={filters.model_name} onChange={f('model_name')} width='full' />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>分组</div>
              <Input value={filters.group} onChange={f('group')} width='full' />
            </div>
            {isAdmin && (
              <>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>渠道</div>
                  <Input value={filters.channel} onChange={f('channel')} width='full' />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>用户名</div>
                  <Input value={filters.username} onChange={f('username')} width='full' />
                </div>
              </>
            )}
            <div>
              <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>Request ID</div>
              <Input value={filters.request_id} onChange={f('request_id')} width='full' />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant='toggle' onClick={reset}>重置</Button>
            <Button onClick={() => load(1)}>搜索</Button>
          </div>
        </div>
      )}

      {/* 表格 */}
      {loading ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><Loading /></div> : (
        <>
          <div style={{ fontFamily: "'JetBrains Mono', 'Noto Sans SC', monospace", maxWidth: '100%', overflow: isMobile ? 'auto' : 'hidden' }}>
            <Table
              columns={columns}
              rows={enriched}
              size='md'
              rowKey='id'
              emptyText='暂无数据'
              onRowClick={(r) => setExpanded((prev) => prev === r.id ? null : r.id)}
              expandedKey={expanded}
              renderExpanded={(r) => <LogDetail row={r} isAdmin={isAdmin} isMobile={isMobile} onClose={() => setExpanded(null)} />}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Pagination total={total} pageSize={PAGE_SIZE} page={page} onChange={(p) => load(p)} />
          </div>
        </>
      )}
    </div>
  );
};

// ── 详情面板 ──────────────────────────────────────────

const LogDetail = ({ row: r, isAdmin, isMobile, onClose }) => {
  const other = r._other;
  return (
    <div style={{ padding: '16px 18px', background: 'var(--ui-bg-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TypeBadge type={r.type} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ui-text)' }}>{r.model_name || '系统操作'}</span>
          <span style={{ fontSize: 12, color: 'var(--ui-text-3)' }}>{timestamp2string(r.created_at)}</span>
        </div>
        <button onClick={onClose} style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: 12, color: 'var(--ui-text-3)' }}>收起</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '8px 24px', fontSize: 13 }}>
        <DetailItem label='Token 名称' value={r.token_name || '-'} />
        <DetailItem label='分组' value={r.group || '-'} />
        <DetailItem label='Prompt Tokens' value={renderNumber(r.prompt_tokens || 0)} />
        <DetailItem label='Completion Tokens' value={renderNumber(r.completion_tokens || 0)} />
        {r._cacheHit > 0 && <DetailItem label='缓存命中' value={renderNumber(r._cacheHit)} />}
        {r._cacheWrite > 0 && <DetailItem label='缓存创建' value={renderNumber(r._cacheWrite)} />}
        {other?.cache_creation_ratio != null && <DetailItem label='缓存创建倍率' value={other.cache_creation_ratio} />}
        {other?.cache_ratio != null && <DetailItem label='缓存倍率' value={other.cache_ratio} />}
        {other?.model_ratio != null && <DetailItem label='模型倍率' value={other.model_ratio} />}
        {other?.completion_ratio != null && <DetailItem label='补全倍率' value={other.completion_ratio} />}
        {other?.group_ratio != null && <DetailItem label='分组倍率' value={other.group_ratio} />}
        {other?.model_price != null && <DetailItem label='模型价格' value={other.model_price === 0 ? '默认' : other.model_price} />}
        {other?.user_group_ratio != null && <DetailItem label='用户分组倍率' value={other.user_group_ratio === 0 ? '默认' : other.user_group_ratio} />}
        {other?.frt != null && other.frt > 0 && <DetailItem label='首字耗时' value={`${other.frt}ms`} />}
        {other?.wallet && <DetailItem label='计费来源' value={other.wallet} />}
        {other?.request_convert && <DetailItem label='请求转换' value={other.request_convert} />}
        {other?.request_path && <DetailItem label='请求路径' value={other.request_path} mono />}
        {other?.usage_semantic && <DetailItem label='Usage 语义' value={other.usage_semantic} />}
        {other?.stream_status && <DetailItem label='流式状态' value={`${other.stream_status.status || ''}${other.stream_status.end_reason ? ' (' + other.stream_status.end_reason + ')' : ''}`} />}
        {isAdmin && other?.channel_id != null && <DetailItem label='渠道 ID' value={other.channel_id} />}
        <DetailItem label='Request ID' value={r.request_id || '-'} mono />
        <DetailItem label='IP' value={r.ip || '-'} mono />
        {isAdmin && <DetailItem label='用户' value={r.username || '-'} />}
        {r.content && (
          <div style={{ gridColumn: '1 / -1' }}>
            <DetailItem label='Content' value={r.content} multiline />
          </div>
        )}
      </div>
    </div>
  );
};

// ── 详情行 ──────────────────────────────────────────────

const DetailItem = ({ label, value, mono, multiline }) => (
  <div style={{ display: 'flex', gap: 8, minWidth: 0 }}>
    <span style={{ color: 'var(--ui-text-3)', width: 110, flexShrink: 0, fontSize: 12 }}>{label}</span>
    <span style={{
      color: 'var(--ui-text)', fontSize: 13, minWidth: 0,
      fontFamily: mono ? "'JetBrains Mono', monospace" : 'inherit',
      whiteSpace: multiline ? 'pre-wrap' : 'normal',
      wordBreak: 'break-all',
      overflow: 'hidden', textOverflow: 'ellipsis',
    }}>{value}</span>
  </div>
);

export default LogPage;

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Copy, LayoutGrid, Rows3 } from 'lucide-react';
import { API, showError, showSuccess, copy, getLobeHubIcon } from '../../helpers';
import {
  PageShell, Card, Button, IconButton, Input, Select, Table, Tag, Loading,
} from '../../components/ui';

const PricingPage = () => {
  const navigate = useNavigate();
  const [models, setModels] = useState([]);
  const [vendors, setVendors] = useState({});
  const [groupRatio, setGroupRatio] = useState({});
  const [usableGroups, setUsableGroups] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [group, setGroup] = useState('all');
  const [view, setView] = useState(() => localStorage.getItem('pricing-view') || 'table');
  const switchView = (v) => { setView(v); localStorage.setItem('pricing-view', v); };
  const goDetail = (m) => {
    const params = group !== 'all' ? `?group=${encodeURIComponent(group)}` : '';
    navigate(`/pricing/${encodeURIComponent(m.model_name)}${params}`);
  };

  useEffect(() => {
    (async () => {
      try {
        const { data } = await API.get('/api/pricing');
        if (data.success) {
          setModels(data.data || []);
          const vmap = {};
          (data.vendors || []).forEach((v) => { vmap[v.id] = v; });
          setVendors(vmap);
          setGroupRatio(data.group_ratio || {});
          setUsableGroups(data.usable_group || {});
        } else showError(data.message);
      } catch (e) { showError(e); } finally { setLoading(false); }
    })();
  }, []);

  const groupMul = group === 'all' ? 1 : (groupRatio[group] ?? 1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (models || []).filter((m) => {
      if (q && !m.model_name?.toLowerCase().includes(q)) return false;
      if (vendorFilter !== 'all' && m.vendor_id !== Number(vendorFilter)) return false;
      if (group !== 'all' && Array.isArray(m.enable_groups) && !m.enable_groups.includes(group)) return false;
      return true;
    });
  }, [models, search, vendorFilter, group]);

  const compute = (m) => {
    if (m.quota_type === 1) {
      const dollar = (m.model_price || 0) * groupMul;
      return `$${dollar.toFixed(4)} / 次`;
    }
    const promptPerM = (m.model_ratio || 0) * 2 * groupMul;
    const completionPerM = promptPerM * (m.completion_ratio || 1);
    return `$${promptPerM.toFixed(3)} / $${completionPerM.toFixed(3)} per 1M`;
  };

  const vendorOptions = [
    { value: 'all', label: '全部厂商' },
    ...Object.values(vendors).map((v) => ({ value: String(v.id), label: v.name })),
  ];

  const groupOptions = [
    { value: 'all', label: '默认分组' },
    ...Object.entries(usableGroups).map(([k, v]) => ({
      value: k,
      label: `${v?.desc || k} (×${groupRatio[k] ?? 1})`,
    })),
  ];

  const columns = [
    { key: 'model_name', title: '模型', render: (r) => (
        <div className='flex items-center gap-2'>
          <span className='font-mono text-xs'>{r.model_name}</span>
          <IconButton icon={Copy} onClick={(e) => { e.stopPropagation(); copy(r.model_name); showSuccess('已复制'); }} />
        </div>
      ) },
    { key: 'vendor', title: '厂商', render: (r) => (
        <div className='flex items-center gap-1.5'>
          {vendors[r.vendor_id]?.icon && getLobeHubIcon(vendors[r.vendor_id].icon, 16)}
          <span>{vendors[r.vendor_id]?.name || '-'}</span>
        </div>
      ) },
    { key: 'endpoints', title: '端点', render: (r) =>
        <div className='flex flex-wrap gap-1'>
          {(r.supported_endpoint_types || []).slice(0, 3).map((e) => <Tag key={e} color='blue'>{e}</Tag>)}
        </div> },
    { key: 'price', title: `价格 (×${groupMul})`, render: (r) => <span className='font-mono text-xs'>{compute(r)}</span> },
    { key: 'groups', title: '可用分组', render: (r) =>
        <div className='flex flex-wrap gap-1'>
          {(r.enable_groups || []).slice(0, 3).map((g) => <Tag key={g}>{g}</Tag>)}
        </div> },
  ];

  return (
    <PageShell
      title='模型定价'
      actions={
        <div className='flex items-center gap-1'>
          <IconButton icon={Rows3}    title='表格视图' selected={view === 'table'} onClick={() => switchView('table')} />
          <IconButton icon={LayoutGrid} title='卡片视图' selected={view === 'card'}  onClick={() => switchView('card')} />
        </div>
      }
    >
      <Card className='mb-4'>
        <div className='flex flex-wrap items-center gap-3'>
          <div className='flex-1 min-w-[200px] max-w-[320px]'>
            <Input
              placeholder='搜索模型名'
              value={search}
              onChange={setSearch}
            />
          </div>
          <div className='w-48'>
            <Select value={vendorFilter} onChange={setVendorFilter} options={vendorOptions} />
          </div>
          <div className='w-48'>
            <Select value={group} onChange={setGroup} options={groupOptions} />
          </div>
        </div>
      </Card>

      {loading ? (
        <div style={{ minHeight: 'calc(100vh - 280px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loading />
        </div>
      ) : (
        <>
          <p className='text-sm text-ui-text-3 mb-3'>共 {filtered.length} 个模型 · 点击查看详情</p>
          {view === 'table' ? (
            <Table columns={columns} rows={filtered} size='sm' rowKey='model_name' onRowClick={goDetail} />
          ) : (
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
              {filtered.map((m) => (
                <Card key={m.model_name} interactive='hover' onClick={() => goDetail(m)}>
                  <div className='font-mono text-xs text-ui-text-1 break-all mb-2'>{m.model_name}</div>
                  <div className='text-xs text-ui-text-3 mb-3'>{vendors[m.vendor_id]?.name || '未知厂商'}</div>
                  <div className='text-sm text-ui-text-1 font-mono mb-3'>{compute(m)}</div>
                  <div className='flex flex-wrap gap-1'>
                    {(m.supported_endpoint_types || []).slice(0, 4).map((e) => (
                      <Tag key={e} color='blue'>{e}</Tag>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </PageShell>
  );
};

export default PricingPage;

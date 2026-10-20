import { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/auth-store';
import { date, errorText, request, statuses } from './api';
import type { Deployment, Page, Settings } from './api';
import DeploymentSettings from './DeploymentSettings';
import DeploymentForm from './DeploymentForm';
import DeploymentDetails from './DeploymentDetails';
import { Button, ErrorMessage, Input, PageShell, Pagination, Select, Table } from './ui';

function DeploymentSession({ root }: { root: boolean }) {
  const [settings, setSettings] = useState<Settings>();
  const [configuration, setConfiguration] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Deployment>();
  const [rows, setRows] = useState<Deployment[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = () => setRevision((value) => value + 1);
  const saved = () => { setSelected(undefined); setCreating(false); setConfiguration(false); refresh(); };
  useEffect(() => {
    const abort = new AbortController(); setLoading(true); setError('');
    (async () => {
      try {
        const config = await request<Settings>('get', '/api/deployments/settings', undefined, abort.signal);
        if (abort.signal.aborted) return;
        setSettings(config);
        if (config.can_connect) {
          const query = new URLSearchParams({ p: String(page), page_size: '20', status: filter });
          const result = await request<Page>('get', `/api/deployments/?${query}`, undefined, abort.signal);
          if (!abort.signal.aborted) { setRows(result.items || []); setTotal(result.total || 0); }
        } else { setRows([]); setTotal(0); }
      } catch (cause) { if (!abort.signal.aborted) setError(errorText(cause)); }
      finally { if (!abort.signal.aborted) setLoading(false); }
    })();
    return () => abort.abort();
  }, [page, filter, revision]);
  return <PageShell title='模型部署' actions={<><Button size='sm' loading={loading} onClick={refresh}>刷新部署</Button>{root && <Button size='sm' disabled={!settings} onClick={() => setConfiguration(true)}>部署配置</Button>}<Button size='sm' disabled={!settings?.can_connect} onClick={() => setCreating(true)}>新建部署</Button></>}>
    <div className='space-y-4'>
      <ErrorMessage message={error} />
      <p className='text-sm text-ui-text-2'>管理 io.net GPU 部署、容器与日志。计算资源和费用由 io.net 账户管理。</p>
      {settings && !settings.can_connect && <p className='rounded-xl border border-ui-border p-4 text-sm text-ui-text-2'>部署服务尚未启用或未配置密钥。{root ? '请打开部署配置完成连接。' : '请联系超级管理员配置。'}</p>}
      <div className='grid gap-3 sm:grid-cols-2'><Input aria-label='筛选当前页部署名称' placeholder='筛选当前页部署名称' value={keyword} onChange={setKeyword} /><Select width='full' value={filter} onChange={(value) => { setFilter(value); setPage(1); }} options={[{ value: '', label: '全部部署状态' }, ...Object.entries(statuses).map(([value, label]) => ({ value, label }))]} /></div>
      <Table<Deployment> rows={rows.filter((item) => item.deployment_name.toLowerCase().includes(keyword.toLowerCase()))} rowKey='id' minWidth={720} columns={[
        { key: 'name', title: '部署', render: (item) => <div className='max-w-64 break-all text-sm font-medium'>{item.deployment_name}<p className='text-xs font-normal text-ui-text-3'>{item.id}</p></div> },
        { key: 'status', title: '状态', render: (item) => statuses[item.status] || item.status },
        { key: 'hardware', title: '硬件', render: (item) => item.hardware_info || item.hardware_name || '—' },
        { key: 'time', title: '剩余 / 创建时间', render: (item) => <div className='whitespace-nowrap text-xs'>{item.compute_minutes_remaining} 分钟<p className='text-ui-text-3'>{date(item.created_at)}</p></div> },
        { key: 'actions', title: '管理', render: (item) => <Button size='sm' onClick={() => setSelected(item)}>管理部署</Button> },
      ]} />
      <Pagination page={page} pageSize={20} total={total} onChange={setPage} />
    </div>
    {configuration && settings && root && <DeploymentSettings settings={settings} onClose={() => setConfiguration(false)} onSaved={saved} />}
    {creating && settings?.can_connect && <DeploymentForm onClose={() => setCreating(false)} onCreated={saved} />}
    {selected && <DeploymentDetails key={selected.id} deployment={selected} onClose={() => setSelected(undefined)} onChanged={saved} />}
  </PageShell>;
}

export default function DeploymentPage() {
  const user = useAuthStore((state) => state.auth.user);
  return user && user.role >= 10 ? <DeploymentSession key={user.id} root={user.role === 100} /> : <PageShell title='无访问权限'><p className='text-sm text-ui-text-2'>此页面仅供管理员使用。</p></PageShell>;
}

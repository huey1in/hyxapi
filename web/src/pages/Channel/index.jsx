import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Power, PowerOff, Activity, RefreshCw, CheckSquare, Square, Tag as TagIcon } from 'lucide-react';
import { API, showError, showSuccess, renderQuota, timestamp2string } from '../../helpers';
import {
  PageShell, Card, Button, IconButton, Input, NumberInput, Select, Textarea, Table, Pagination,
  Tag, Modal, ConfirmDialog, Loading,
} from '../../components/ui';

const PAGE_SIZE = 20;

const STATUS_TAG = {
  1: { color: 'green', text: '启用' },
  2: { color: 'red',   text: '禁用' },
  3: { color: 'amber', text: '自动禁用' },
};

const ChannelPage = () => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [statusF, setStatusF] = useState('all');
  const [typeF, setTypeF] = useState('all');
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [tagMode, setTagMode] = useState(false);
  const [testing, setTesting] = useState(null);

  const load = async (p = 1, kw = '', s = statusF, ty = typeF, tm = tagMode) => {
    setLoading(true);
    try {
      const typeParam = ty !== 'all' ? `&type=${ty}` : '';
      const statusParam = s !== 'all' ? `&status=${s}` : '';
      const url = kw
        ? `/api/channel/search?keyword=${encodeURIComponent(kw)}&p=${p}&page_size=${PAGE_SIZE}&tag_mode=${tm}${typeParam}${statusParam}`
        : `/api/channel/?p=${p}&page_size=${PAGE_SIZE}&id_sort=true&tag_mode=${tm}${typeParam}${statusParam}`;
      const res = await API.get(url);
      const { success, data, message } = res.data || {};
      if (success) {
        setRows(data.items || []);
        setTotal(data.total || 0);
        setPage(p);
      } else showError(message);
    } catch (e) { showError(e); } finally { setLoading(false); }
  };
  useEffect(() => { load(1, ''); }, []);

  const toggleAll = () => {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };
  const toggleOne = (id) => {
    setSelected((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const batch = async (action) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return showError('请先选择渠道');
    try {
      if (action === 'delete') {
        const res = await API.post('/api/channel/batch', { ids });
        const { success, message } = res.data || {};
        if (success) { showSuccess(`已删除 ${ids.length} 个`); setSelected(new Set()); load(page, keyword); }
        else showError(message);
      } else {
        const status = action === 'enable' ? 1 : 2;
        await Promise.all(ids.map((id) => API.put('/api/channel/', { id, status })));
        showSuccess(`已${action === 'enable' ? '启用' : '禁用'} ${ids.length} 个`);
        setSelected(new Set()); load(page, keyword);
      }
    } catch (e) { showError(e); }
  };

  const manageTag = async (tag, action) => {
    try {
      const res = await API.post(`/api/channel/tag/${action}`, { tag });
      const { success, message } = res.data || {};
      if (success) { showSuccess(`已${action === 'enabled' ? '启用' : '禁用'} 标签下所有渠道`); load(page, keyword); }
      else showError(message);
    } catch (e) { showError(e); }
  };

  const setStatus = async (row, status) => {
    try {
      const res = await API.put('/api/channel/', { id: row.id, status });
      const { success, message } = res.data || {};
      if (success) { showSuccess('已更新'); load(page, keyword); }
      else showError(message);
    } catch (e) { showError(e); }
  };

  const remove = async (row) => {
    try {
      const res = await API.delete(`/api/channel/${row.id}/`);
      const { success, message } = res.data || {};
      if (success) { showSuccess('已删除'); setConfirm(null); load(page, keyword); }
      else showError(message);
    } catch (e) { showError(e); }
  };

  const test = async (row) => {
    try {
      const res = await API.get(`/api/channel/test/${row.id}`);
      const { success, message, time } = res.data || {};
      if (success) showSuccess(`测试通过 (${time?.toFixed?.(2) ?? '-'}s)`);
      else showError(message || '测试失败');
    } catch (e) { showError(e); }
  };

  const openTest = (row) => setTesting(row);

  const columns = [
    { key: '_sel', title: (
        <button onClick={toggleAll} className='inline-flex items-center text-ui-text-2 hover:text-ui-text-1'>
          {selected.size > 0 && selected.size === rows.length
            ? <CheckSquare size={16} />
            : <Square size={16} />}
        </button>
      ), width: 36, render: (r) => (
        <button onClick={() => toggleOne(r.id)} className='inline-flex items-center text-ui-text-2 hover:text-ui-text-1'>
          {selected.has(r.id) ? <CheckSquare size={16} /> : <Square size={16} />}
        </button>
      ) },
    { key: 'id', title: 'ID', width: 70 },
    { key: 'name', title: '名称' },
    ...(tagMode ? [{ key: 'tag', title: '标签', render: (r) => r.tag ? <Tag color='blue'>{r.tag}</Tag> : '-' }] : []),
    { key: 'type', title: '类型' },
    { key: 'group', title: '分组', render: (r) => r.group || 'default' },
    { key: 'status', title: '状态', render: (r) => {
        const s = STATUS_TAG[r.status] || STATUS_TAG[2];
        return <Tag color={s.color}>{s.text}</Tag>;
      } },
    { key: 'priority', title: '优先级' },
    { key: 'weight', title: '权重' },
    { key: 'used_quota', title: '已用', render: (r) => renderQuota(r.used_quota || 0, 2) },
    { key: 'response_time', title: '响应', render: (r) => r.response_time ? `${(r.response_time / 1000).toFixed(2)}s` : '-' },
    { key: 'ops', title: '操作', align: 'right', render: (r) => (
        <div className='flex justify-end gap-1'>
          <IconButton icon={Activity} title='测试' onClick={() => openTest(r)} />
          <IconButton icon={Pencil} title='编辑' onClick={() => setEditing({ ...r })} />
          {r.status === 1
            ? <IconButton icon={PowerOff} title='禁用' onClick={() => setStatus(r, 2)} />
            : <IconButton icon={Power} title='启用' onClick={() => setStatus(r, 1)} />}
          <IconButton icon={Trash2} variant='danger' title='删除'
            onClick={() => setConfirm({ title: `删除渠道 ${r.name}?`, onOk: () => remove(r) })} />
        </div>
      ) },
  ];

  return (
    <PageShell
      title='渠道管理'
      actions={
        <>
          {selected.size > 0 && (
            <>
              <span className='text-xs text-ui-text-3 mr-1'>已选 {selected.size} 项</span>
              <Button size='sm' variant='toggle' onClick={() => batch('enable')}>批量启用</Button>
              <Button size='sm' variant='toggle' onClick={() => batch('disable')}>批量禁用</Button>
              <Button size='sm' variant='toggle' onClick={() => setConfirm({
                title: `删除选中的 ${selected.size} 个渠道?`,
                onOk: () => batch('delete'),
              })}>批量删除</Button>
            </>
          )}
          <Button icon={Plus} onClick={() => setEditing({ name: '', type: 1, key: '', base_url: '', group: 'default', priority: 0, weight: 0, models: '' })}>新建渠道</Button>
        </>
      }
    >
      <Card className='mb-4'>
        <div className='flex flex-wrap items-center gap-2'>
          <Input
            placeholder='搜索渠道名称/key/分组'
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(1, keyword)}
            className='flex-1 min-w-[200px]'
          />
          <div className='w-36'>
            <Select
              value={statusF}
              onChange={(v) => { setStatusF(v); load(1, keyword, v, typeF); }}
              options={[
                { value: 'all', label: '全部状态' },
                { value: '1', label: '启用' },
                { value: '2', label: '禁用' },
                { value: '3', label: '自动禁用' },
              ]}
            />
          </div>
          <div className='w-44'>
            <Select
              value={typeF}
              onChange={(v) => { setTypeF(v); load(1, keyword, statusF, v); }}
              options={[{ value: 'all', label: '全部类型' }, ...TYPE_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))]}
            />
          </div>
          <Button onClick={() => load(1, keyword)}>搜索</Button>
          <Button
            size='sm'
            variant='toggle'
            selected={tagMode}
            icon={TagIcon}
            onClick={() => { setTagMode((s) => !s); load(1, keyword, statusF, typeF, !tagMode); }}
          >
            标签视图
          </Button>
          <IconButton icon={RefreshCw} title='刷新' onClick={() => load(page, keyword)} />
        </div>
      </Card>

      {loading ? <Loading /> : (
        <>
          <Table columns={columns} rows={rows} />
          <div className='mt-4 flex justify-end'>
            <Pagination total={total} pageSize={PAGE_SIZE} page={page} onChange={(p) => load(p, keyword)} />
          </div>
        </>
      )}

      {editing && (
        <ChannelEditModal channel={editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(page, keyword); }} />
      )}
      {confirm && (
        <ConfirmDialog open title={confirm.title} onConfirm={confirm.onOk}
          onClose={() => setConfirm(null)} />
      )}
      {testing && (
        <ChannelTestModal channel={testing} onClose={() => setTesting(null)} />
      )}
    </PageShell>
  );
};

const ChannelTestModal = ({ channel, onClose }) => {
  const initial = (channel.models || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 8);
  const [models, setModels] = useState(initial.join('\n'));
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(false);

  const run = async () => {
    const list = models.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) return showError('请输入至少一个模型');
    setResults({}); setRunning(true);
    for (const m of list) {
      setResults((p) => ({ ...p, [m]: { status: 'running' } }));
      try {
        const res = await API.get(`/api/channel/test/${channel.id}?model=${encodeURIComponent(m)}`);
        const { success, message, time } = res.data || {};
        setResults((p) => ({ ...p, [m]: success
          ? { status: 'ok', time }
          : { status: 'fail', message: message || '失败' } }));
      } catch (e) {
        setResults((p) => ({ ...p, [m]: { status: 'fail', message: e.message || '请求失败' } }));
      }
    }
    setRunning(false);
  };

  return (
    <Modal open title={`测试渠道 #${channel.id} - ${channel.name}`} onClose={onClose} hideFooter width={640}>
      <div className='space-y-4'>
        <div>
          <label className='block text-sm text-ui-text-2 mb-1.5'>测试模型（每行一个，或逗号分隔）</label>
          <Textarea value={models} onChange={setModels} rows={3} placeholder='gpt-4o\nclaude-3-5-sonnet\ndeepseek-chat' />
        </div>
        <div className='flex justify-end gap-2'>
          <Button variant='toggle' onClick={onClose}>关闭</Button>
          <Button loading={running} onClick={run}>{running ? '测试中…' : '开始测试'}</Button>
        </div>
        {Object.keys(results).length > 0 && (
          <div className='space-y-1.5 max-h-64 overflow-auto'>
            {Object.entries(results).map(([m, r]) => (
              <div key={m} className='flex items-center justify-between gap-2 p-2 rounded-lg border border-ui-border text-sm'>
                <span className='font-mono text-xs text-ui-text-1 truncate flex-1'>{m}</span>
                {r.status === 'running' && <Tag color='grey'>测试中…</Tag>}
                {r.status === 'ok' && <Tag color='green'>{r.time?.toFixed?.(2) ?? '-'}s</Tag>}
                {r.status === 'fail' && <Tag color='red' title={r.message}>失败: {String(r.message || '').slice(0, 40)}</Tag>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};

const TYPE_OPTIONS = [
  { value: 1,  label: 'OpenAI' },
  { value: 3,  label: 'Azure OpenAI' },
  { value: 14, label: 'Anthropic Claude' },
  { value: 24, label: 'Google Gemini' },
  { value: 17, label: 'Aliyun Qwen' },
  { value: 16, label: 'Zhipu' },
  { value: 25, label: 'Moonshot' },
  { value: 36, label: 'DeepSeek' },
  { value: 26, label: 'BAAI Baichuan' },
  { value: 41, label: 'Cohere' },
  { value: 43, label: 'Mistral' },
  { value: 50, label: 'xAI Grok' },
  { value: 8,  label: 'Custom OpenAI Compatible' },
];

const ChannelEditModal = ({ channel, onClose, onSaved }) => {
  const isEdit = !!channel.id;
  const [form, setForm] = useState(channel);
  const [saving, setSaving] = useState(false);
  const u = (k) => (v) => setForm((p) => ({ ...p, [k]: v?.target ? v.target.value : v }));

  const save = async () => {
    if (!form.name?.trim()) return showError('请输入渠道名称');
    if (!isEdit && !form.key?.trim()) return showError('请输入 API key');
    setSaving(true);
    try {
      const payload = { ...form };
      const res = isEdit
        ? await API.put('/api/channel/', payload)
        : await API.post('/api/channel/', payload);
      const { success, message } = res.data || {};
      if (success) { showSuccess(isEdit ? '已更新' : '已创建'); onSaved(); }
      else showError(message);
    } catch (e) { showError(e); } finally { setSaving(false); }
  };

  return (
    <Modal open title={isEdit ? `编辑渠道 #${channel.id}` : '新建渠道'} onClose={onClose} onConfirm={save} loading={saving} width={600}>
      <div className='space-y-4'>
        <div className='grid grid-cols-2 gap-4'>
          <div>
            <label className='block text-sm text-ui-text-2 mb-1.5'>名称</label>
            <Input value={form.name || ''} onChange={u('name')} />
          </div>
          <div>
            <label className='block text-sm text-ui-text-2 mb-1.5'>类型</label>
            <Select value={form.type} onChange={(v) => u('type')(Number(v))} options={TYPE_OPTIONS} />
          </div>
        </div>
        <div>
          <label className='block text-sm text-ui-text-2 mb-1.5'>API Key {isEdit && <span className='text-ui-text-3'>(留空不修改)</span>}</label>
          <Input value={form.key || ''} onChange={u('key')} placeholder='sk-...' />
        </div>
        <div>
          <label className='block text-sm text-ui-text-2 mb-1.5'>Base URL</label>
          <Input value={form.base_url || ''} onChange={u('base_url')} placeholder='https://api.example.com' />
        </div>
        <div className='grid grid-cols-3 gap-4'>
          <div>
            <label className='block text-sm text-ui-text-2 mb-1.5'>分组</label>
            <Input value={form.group || ''} onChange={u('group')} />
          </div>
          <div>
            <label className='block text-sm text-ui-text-2 mb-1.5'>优先级</label>
            <NumberInput value={form.priority || 0} onChange={(v) => u('priority')(Number(v))} />
          </div>
          <div>
            <label className='block text-sm text-ui-text-2 mb-1.5'>权重</label>
            <NumberInput value={form.weight || 0} onChange={(v) => u('weight')(Number(v))} />
          </div>
        </div>
        <div>
          <label className='block text-sm text-ui-text-2 mb-1.5'>支持模型（逗号分隔）</label>
          <Textarea value={form.models || ''} onChange={u('models')} rows={3}
            placeholder='gpt-4o,gpt-4-turbo,claude-3-5-sonnet' />
        </div>
      </div>
    </Modal>
  );
};

export default ChannelPage;

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Power, PowerOff, Activity, RefreshCw, CheckSquare, Square, Tag as TagIcon, ChevronDown, Play, RotateCcw, PlusCircle } from 'lucide-react';
import { API, showError, showSuccess, renderQuota, getChannelModels } from '../../helpers';
import {
  PageShell, Card, Button, IconButton, Input, NumberInput, Select, MultiSelect, Textarea, Table, Pagination,
  Tag, Modal, SlideOver, ConfirmDialog, Loading, Switch,
} from '../../components/ui';
import { cn } from '../../components/ui/tokens';
import { MODEL_FETCHABLE_CHANNEL_TYPES } from '../../constants/channel.constants';
import { priorityMove } from './priority.js';

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
  const [dragMode, setDragMode] = useState(false);
  const [dragged, setDragged] = useState(null);
  const [placement, setPlacement] = useState('before');
  const [priorityUndo, setPriorityUndo] = useState(null);
  const [priorityBusy, setPriorityBusy] = useState(false);
  const [dropTarget, setDropTarget] = useState(null);

  const savePriorities = async (changes, undo = false) => {
    if (!changes.length) return;
    setPriorityBusy(true);
    try {
      const { data } = await API.put('/api/channel/priority', { changes });
      if (!data.success) throw new Error(data.message);
      setPriorityUndo(undo ? null : changes.map((change) => ({ ...change, before: change.priority, priority: change.before })));
      await load(page, keyword);
    } catch (error) { showError(error); } finally { setPriorityBusy(false); }
  };

  const movePriority = async (sourceID, targetID) => {
    const request = priorityMove(rows, sourceID, targetID, placement);
    if (!request) return;
    setPriorityBusy(true);
    try {
      const { data } = await API.put('/api/channel/priority/move', request);
      if (!data.success) throw new Error(data.message);
      const changes = data.data?.changes || [];
      setPriorityUndo(changes.length ? changes.map((change) => ({ ...change, before: change.priority, priority: change.before })) : null);
      await load(page, keyword);
    } catch (error) { showError(error); } finally { setPriorityBusy(false); }
  };

  const load = async (p = 1, kw = '', s = statusF, ty = typeF, tm = tagMode) => {
    setLoading(true);
    try {
      const typeParam = ty !== 'all' ? `&type=${ty}` : '';
      const statusParam = s !== 'all' ? `&status=${s}` : '';
      const url = kw
        ? `/api/channel/search?keyword=${encodeURIComponent(kw)}&p=${p}&page_size=${PAGE_SIZE}&tag_mode=${tm}${typeParam}${statusParam}`
        : `/api/channel/?p=${p}&page_size=${PAGE_SIZE}&id_sort=false&tag_mode=${tm}${typeParam}${statusParam}`;
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
          <Button size='sm' variant='toggle' selected={dragMode} disabled={priorityBusy || tagMode} onClick={() => setDragMode((value) => !value)}>拖动排序</Button>
          {priorityUndo && <Button size='sm' variant='toggle' disabled={priorityBusy} onClick={() => savePriorities(priorityUndo, true)}>撤销排序</Button>}
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
            onChange={setKeyword}
            onKeyDown={(e) => e.key === 'Enter' && load(1, keyword)}
            width={240}
          />
          <Select
            value={statusF}
            onChange={(v) => { setStatusF(v); load(1, keyword, v, typeF); }}
            width={120}
            options={[
              { value: 'all', label: '全部状态' },
              { value: '1', label: '启用' },
              { value: '2', label: '禁用' },
              { value: '3', label: '自动禁用' },
            ]}
          />
          <Select
            value={typeF}
            onChange={(v) => { setTypeF(v); load(1, keyword, statusF, v); }}
            width={120}
            options={[{ value: 'all', label: '全部类型' }, ...TYPE_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))]}
          />
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
          {dragMode && <div className='flex items-center gap-2 mb-3 text-sm'>
            <span>拖放位置</span>
            <Select value={placement} onChange={setPlacement} options={[{ value: 'before', label: '目标优先级之前' }, { value: 'same', label: '与目标同级' }, { value: 'after', label: '目标优先级之后' }]} />
            <span>拖动渠道行以保存优先级，也可在编辑窗口直接填写。</span>
          </div>}
          <Table columns={columns} rows={dragMode ? [...rows].sort((a, b) => (b.priority || 0) - (a.priority || 0) || b.id - a.id) : rows} rowProps={dragMode ? (row) => ({
            draggable: !priorityBusy,
            style: { cursor: 'grab', outline: dropTarget === row.id ? '2px solid var(--ui-text-2)' : undefined },
            onDragStart: (event) => { setDragged(row.id); event.dataTransfer.setData('text/plain', String(row.id)); event.dataTransfer.effectAllowed = 'move'; },
            onDragOver: (event) => { event.preventDefault(); setDropTarget(row.id); },
            onDragEnd: () => { setDragged(null); setDropTarget(null); },
            onDrop: (event) => {
              event.preventDefault(); setDropTarget(null);
              if (priorityBusy) return;
              movePriority(dragged, row.id);
            },
          }) : undefined} />
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
  const [selectedModels, setSelectedModels] = useState(initial);
  const [customModel, setCustomModel] = useState('');
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);
  const [stream, setStream] = useState(false);

  const modelOptions = Array.from(new Set([...(channel.models || '').split(',').map((s) => s.trim()).filter(Boolean), ...selectedModels]));
  const channelTypeLabel = TYPE_OPTIONS.find((o) => o.value === channel.type)?.label || channel.type || '-';

  const toggleModel = (model) => {
    if (running) return;
    setSelectedModels((prev) => (
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model]
    ));
  };

  const addCustomModel = () => {
    const values = customModel.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    if (values.length === 0) return;
    setSelectedModels((prev) => Array.from(new Set([...prev, ...values])));
    setCustomModel('');
  };

  const run = async () => {
    const list = selectedModels;
    if (list.length === 0) return showError('请选择至少一个模型');
    setResults(list.map((model) => ({ model, status: 'pending' })));
    setRunning(true);
    for (const m of list) {
      setResults((p) => p.map((r) => (r.model === m ? { ...r, status: 'running', message: '' } : r)));
      try {
        const params = new URLSearchParams({ model: m });
        if (stream) params.set('stream', 'true');
        const res = await API.get(`/api/channel/test/${channel.id}?${params.toString()}`);
        const { success, message, time, error_code: errorCode } = res.data || {};
        setResults((p) => p.map((r) => (r.model === m
          ? {
              ...r,
              status: success ? 'ok' : 'fail',
              time,
              errorCode,
              message: success ? (message || '测试通过') : (message || '失败'),
            }
          : r)));
      } catch (e) {
        setResults((p) => p.map((r) => (r.model === m
          ? { ...r, status: 'fail', message: e.message || '请求失败' }
          : r)));
      }
    }
    setRunning(false);
  };

  const resultColumns = [
    { key: 'model', title: '模型', render: (r) => <span className='font-mono text-xs break-all'>{r.model}</span> },
    { key: 'status', title: '状态', width: 96, render: (r) => {
        if (r.status === 'pending') return <Tag color='grey'>等待</Tag>;
        if (r.status === 'running') return <Tag color='blue'>测试中</Tag>;
        if (r.status === 'ok') return <Tag color='green'>通过</Tag>;
        return <Tag color='red'>失败</Tag>;
      } },
    { key: 'time', title: '耗时', width: 88, render: (r) => r.status === 'ok' ? `${Number(r.time || 0).toFixed(2)}s` : '-' },
    { key: 'message', title: '返回信息', render: (r) => (
        <span className={cn('text-xs break-words', r.status === 'fail' ? 'text-ui-danger' : 'text-ui-text-2')}>
          {r.errorCode ? `[${r.errorCode}] ` : ''}{r.message || '-'}
        </span>
      ) },
  ];

  return (
    <Modal
      open
      title={(
        <div className='flex w-[760px] max-w-full items-center justify-between gap-4'>
          <span>测试渠道</span>
          <label className='flex items-center gap-2 text-xs font-normal text-ui-text-2'>
            流式
            <Switch size='sm' checked={stream} onChange={setStream} />
          </label>
        </div>
      )}
      onClose={onClose}
      hideFooter
      width={860}
    >
      <div className='space-y-5'>
        <div className='flex flex-wrap items-center gap-x-5 gap-y-2 text-sm'>
          <div className='min-w-0'>
            <span className='text-ui-text-3'>渠道：</span>
            <span className='font-medium text-ui-text'>{channel.name || '-'}</span>
          </div>
          <div>
            <span className='text-ui-text-3'>类型：</span>
            <span className='text-ui-text'>{channelTypeLabel}</span>
          </div>
          <div>
            <span className='text-ui-text-3'>分组：</span>
            <span className='text-ui-text'>{channel.group || 'default'}</span>
          </div>
        </div>

        <div className='grid gap-4 lg:grid-cols-[1fr_148px]'>
          <div>
            <div className='mb-2 flex items-center justify-between gap-3'>
              <label className='block text-sm text-ui-text-2'>测试模型</label>
              {initial.length > 0 && (
                <button
                  type='button'
                  className='text-ui-accent hover:underline'
                  onClick={() => setSelectedModels(initial)}
                  disabled={running}
                >
                  恢复默认
                </button>
              )}
            </div>
            <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-3'>
              {modelOptions.map((model) => {
                const selected = selectedModels.includes(model);
                return (
                  <button
                    key={model}
                    type='button'
                    onClick={() => toggleModel(model)}
                    disabled={running}
                    className={cn(
                      'flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
                      selected
                        ? 'border-ui-accent bg-ui-accent/10 text-ui-text'
                        : 'border-ui-border bg-[var(--page-bg)] text-ui-text-2 hover:bg-ui-bg-subtle',
                      running && 'cursor-not-allowed opacity-70',
                    )}
                  >
                    <ModelCdnIcon model={model} channelType={channel.type} />
                    <span className='min-w-0 flex-1 truncate font-mono text-xs'>{model}</span>
                    {selected && <CheckSquare size={15} className='shrink-0 text-ui-accent' />}
                  </button>
                );
              })}
            </div>
            <div className='mt-3 flex gap-2'>
              <Input
                value={customModel}
                onChange={setCustomModel}
                onKeyDown={(e) => e.key === 'Enter' && addCustomModel()}
                placeholder='手动输入模型 ID，多个用逗号分隔'
                disabled={running}
              />
              <IconButton icon={PlusCircle} title='添加模型' onClick={addCustomModel} disabled={running} />
            </div>
          </div>
          <div className='flex items-start gap-2 lg:justify-end lg:pt-7'>
            <div className='flex gap-2'>
              <Button variant='toggle' icon={RotateCcw} onClick={() => setResults([])} disabled={running}>清空</Button>
              <Button icon={Play} loading={running} onClick={run}>{running ? '测试中' : '开始'}</Button>
            </div>
          </div>
        </div>

        {results.length > 0 && (
          <div className='max-h-80 overflow-auto ui-scrollbar'>
            <Table
              columns={resultColumns}
              rows={results}
              rowKey='model'
              size='sm'
              tableLayout='fixed'
              emptyText='暂无测试结果'
            />
          </div>
        )}
      </div>
    </Modal>
  );
};

const MODEL_ICON_CDN = 'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/light';

const CHANNEL_TYPE_ICON_SLUG = {
  1: 'openai',
  3: 'azureai-color',
  14: 'claude-color',
  24: 'gemini-color',
  41: 'vertexai-color',
  33: 'aws-color',
  17: 'qwen-color',
  16: 'zhipu-color',
  25: 'moonshot-color',
  36: 'suno-color',
  43: 'deepseek-color',
  48: 'xai',
  20: 'openrouter',
  40: 'siliconcloud-color',
  4: 'ollama',
  34: 'cohere-color',
  39: 'cloudflare-color',
  42: 'mistral-color',
  45: 'volcengine-color',
  35: 'minimax-color',
  49: 'coze',
};

const getModelIconSlug = (model, channelType) => {
  const name = String(model || '').toLowerCase();
  if (/claude/.test(name)) return 'claude-color';
  if (/deepseek/.test(name)) return 'deepseek-color';
  if (/gemini|palm/.test(name)) return 'gemini-color';
  if (/gpt|o1|o3|o4|dall|whisper|text-embedding/.test(name)) return 'openai';
  if (/qwen|qwq|tongyi/.test(name)) return 'qwen-color';
  if (/glm|chatglm/.test(name)) return 'zhipu-color';
  if (/moonshot|kimi/.test(name)) return 'moonshot-color';
  if (/mistral|mixtral|codestral/.test(name)) return 'mistral-color';
  if (/grok|xai/.test(name)) return 'xai';
  if (/llama/.test(name)) return 'meta-color';
  if (/command|cohere/.test(name)) return 'cohere-color';
  return CHANNEL_TYPE_ICON_SLUG[channelType] || 'openai';
};

const ModelCdnIcon = ({ model, channelType }) => {
  const [failed, setFailed] = useState(false);
  const slug = getModelIconSlug(model, channelType);
  if (failed) {
    return (
      <span className='flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ui-bg-subtle text-[10px] font-semibold text-ui-text-3'>
        {String(model || '?').slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={`${MODEL_ICON_CDN}/${slug}.png`}
      alt=''
      className='h-6 w-6 shrink-0 rounded-md object-contain'
      loading='lazy'
      onError={() => setFailed(true)}
    />
  );
};

const TYPE_OPTIONS = [
  { value: 1,  label: 'OpenAI' },
  { value: 3,  label: 'Azure OpenAI' },
  { value: 14, label: 'Anthropic Claude' },
  { value: 24, label: 'Google Gemini' },
  { value: 41, label: 'Vertex AI' },
  { value: 33, label: 'AWS Bedrock' },
  { value: 17, label: 'Aliyun Qwen' },
  { value: 16, label: 'Zhipu GLM' },
  { value: 25, label: 'Moonshot' },
  { value: 43, label: 'DeepSeek' },
  { value: 42, label: 'Mistral' },
  { value: 48, label: 'xAI Grok' },
  { value: 20, label: 'OpenRouter' },
  { value: 40, label: 'SiliconFlow' },
  { value: 4,  label: 'Ollama' },
  { value: 34, label: 'Cohere' },
  { value: 39, label: 'Cloudflare' },
  { value: 45, label: 'VolcEngine' },
  { value: 31, label: 'LingYi' },
  { value: 35, label: 'MiniMax' },
  { value: 49, label: 'Coze' },
  { value: 36, label: 'Suno' },
  { value: 8,  label: '自定义 (OpenAI 兼容)' },
];

const MULTI_KEY_MODE_OPTIONS = [
  { value: 'random', label: '随机' },
  { value: 'polling', label: '轮询' },
];

const KeyValueEditor = ({ value, onChange, keyPlaceholder = '键', valuePlaceholder = '值', hint }) => {
  const parsePairs = (v) => {
    if (!v) return [];
    try {
      const obj = typeof v === 'string' ? JSON.parse(v) : v;
      return Object.entries(obj).map(([k, val]) => ({ k, v: String(val) }));
    } catch { return []; }
  };

  const [pairs, setPairs] = useState(() => parsePairs(value));

  const sync = (newPairs) => {
    setPairs(newPairs);
    const obj = {};
    newPairs.forEach(({ k, v }) => { if (k.trim()) obj[k.trim()] = v; });
    onChange(Object.keys(obj).length > 0 ? JSON.stringify(obj) : '');
  };

  const add = () => setPairs((p) => [...p, { k: '', v: '' }]);
  const remove = (i) => sync(pairs.filter((_, idx) => idx !== i));
  const update = (i, field, val) => {
    const next = [...pairs];
    next[i] = { ...next[i], [field]: val };
    sync(next);
  };

  return (
    <div className='space-y-2'>
      {hint && <p className='text-xs text-ui-text-3'>{hint}</p>}
      {pairs.length === 0 && (
        <p className='text-xs text-ui-text-3 py-2'>暂无数据，点击下方按钮添加键值对</p>
      )}
      {pairs.map((p, i) => (
        <div key={i} className='flex items-center gap-2'>
          <Input value={p.k} onChange={(v) => update(i, 'k', v)} width='full' placeholder={keyPlaceholder} />
          <span className='text-ui-text-3 text-xs shrink-0'>→</span>
          <Input value={p.v} onChange={(v) => update(i, 'v', v)} width='full' placeholder={valuePlaceholder} />
          <button onClick={() => remove(i)} className='text-ui-text-3 hover:text-red-500 cursor-pointer text-sm shrink-0'>✕</button>
        </div>
      ))}
      <button onClick={add} className='text-xs text-ui-text-2 hover:text-ui-text cursor-pointer underline'>
        + 添加键值对
      </button>
    </div>
  );
};

const ChannelEditModal = ({ channel, onClose, onSaved }) => {
  const isEdit = !!channel.id;
  const [form, setForm] = useState(() => {
    const setting = channel.setting ? (typeof channel.setting === 'string' ? JSON.parse(channel.setting) : channel.setting) : {};
    const other_settings = channel.other_settings ? (typeof channel.other_settings === 'string' ? JSON.parse(channel.other_settings) : channel.other_settings) : {};
    return { ...channel, setting, other_settings };
  });
  const [mode, setMode] = useState('single');
  const [batchPrefix, setBatchPrefix] = useState(false);
  const [customModel, setCustomModel] = useState('');
  const [groupOptions, setGroupOptions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const u = (k) => (v) => setForm((p) => ({ ...p, [k]: v?.target ? v.target.value : v }));
  const uSetting = (k) => (v) => setForm((p) => ({ ...p, setting: { ...p.setting, [k]: v } }));
  const uOther = (k) => (v) => setForm((p) => ({ ...p, other_settings: { ...p.other_settings, [k]: v } }));

  const save = async () => {
    if (!form.name?.trim()) return showError('请输入渠道名称');
    if (!isEdit && !form.key?.trim()) return showError('请输入 API key');
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.setting && typeof payload.setting === 'object') payload.setting = JSON.stringify(payload.setting);
      if (payload.other_settings && typeof payload.other_settings === 'object') payload.other_settings = JSON.stringify(payload.other_settings);
      let res;
      if (isEdit) {
        res = await API.put('/api/channel/', payload);
      } else {
        res = await API.post('/api/channel/', {
          mode,
          multi_key_mode: mode === 'multi_to_single' ? (form.multi_key_mode || 'random') : undefined,
          batch_add_set_key_prefix_2_name: mode === 'batch' ? batchPrefix : undefined,
          channel: payload,
        });
      }
      const { success, message } = res.data || {};
      if (success) { showSuccess(isEdit ? '已更新' : '已创建'); onSaved(); }
      else showError(message);
    } catch (e) { showError(e); } finally { setSaving(false); }
  };

  useEffect(() => {
    API.get('/api/group/').then((res) => {
      if (res?.data?.data) setGroupOptions(res.data.data.map((g) => ({ value: g, label: g })));
    }).catch(() => {});
  }, []);

  const fetchModels = async () => {
    if (!isEdit) return;
    setFetchingModels(true);
    try {
      const res = await API.get(`/api/channel/fetch_models/${channel.id}`);
      const { success, data, message } = res.data || {};
      if (success && data) {
        const models = Array.isArray(data) ? data.join(',') : data;
        setForm((p) => ({ ...p, models }));
        showSuccess('已获取上游模型列表');
      } else showError(message || '获取失败');
    } catch (e) { showError(e); } finally { setFetchingModels(false); }
  };

  const addCustomModel = () => {
    if (!customModel.trim()) return;
    const current = form.models ? form.models.split(',').map((s) => s.trim()).filter(Boolean) : [];
    if (!current.includes(customModel.trim())) {
      current.push(customModel.trim());
      setForm((p) => ({ ...p, models: current.join(',') }));
    }
    setCustomModel('');
  };

  const clearModels = () => setForm((p) => ({ ...p, models: '' }));

  const fillDefaultModels = () => {
    const defaults = getChannelModels(form.type);
    if (defaults && defaults.length > 0) {
      setForm((p) => ({ ...p, models: defaults.join(',') }));
    } else {
      showError('该类型暂无默认模型列表');
    }
  };

  const fetchModelsFromUrl = async () => {
    const baseUrl = (form.base_url || '').trim();
    const key = (form.key || '').split('\n')[0].trim();
    if (!key) return showError('请先填入密钥');
    setFetchingModels(true);
    try {
      const res = await API.post('/api/channel/fetch_models', {
        base_url: baseUrl || undefined,
        type: form.type,
        key,
      });
      const { success, data, message } = res.data || {};
      if (success && data) {
        const models = Array.isArray(data) ? data.join(',') : data;
        setForm((p) => ({ ...p, models }));
        showSuccess('已从上游获取模型列表');
      } else showError(message || '获取失败');
    } catch (e) { showError(e); } finally { setFetchingModels(false); }
  };

  const isMultiKey = (form.key || '').includes('\n') || form.channel_info?.IsMultiKey;
  const t = form.type;
  const isOpenAI = t === 1 || t === 6;
  const isAzure = t === 3;
  const isClaude = t === 14;
  const isVertex = t === 41;
  const isAWS = t === 33;
  const isGemini = t === 24;
  const isOpenRouter = t === 20;
  const isCoze = t === 49;
  const needsOther = isAzure || isVertex || isGemini || isCoze;

  return (
    <SlideOver
      open
      title={<span className='text-lg font-semibold'>{isEdit ? `编辑渠道 #${channel.id}` : '新建渠道'}</span>}
      onClose={onClose}
      width={560}
      footer={
        <>
          <Button variant='toggle' onClick={onClose}>取消</Button>
          <Button loading={saving} onClick={save}>{isEdit ? '保存' : '创建'}</Button>
        </>
      }
    >
      <div className='px-6 pb-6 space-y-6'>
        {/* 基本信息 */}
        <Section title='基本信息'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <Field label='类型'>
              <Select value={form.type} onChange={(v) => u('type')(Number(v))} options={TYPE_OPTIONS} width='full' />
            </Field>
            <Field label='名称'>
              <Input value={form.name || ''} onChange={u('name')} width='full' placeholder='请为渠道命名' />
            </Field>
          </div>
          {!isEdit && (
            <Field label='创建模式'>
              <Select value={mode} onChange={setMode} width='full' options={[
                { value: 'single', label: '单个创建' },
                { value: 'batch', label: '批量创建（每行一个 key 创建一个渠道）' },
                { value: 'multi_to_single', label: '多 Key 合一（多个 key 归入同一渠道）' },
              ]} />
            </Field>
          )}
        </Section>

        {/* 密钥与连接 */}
        <Section title='密钥与连接'>
          {[1, 58, 59, 60].includes(Number(form.type)) && (
            <Field label='Responses WebSocket' hint='允许 /v1/responses 的持久连接；高级自定义渠道需配置原生 Responses 路由。'>
              <Switch size='sm' checked={!!form.setting?.responses_websocket_enabled} onChange={uSetting('responses_websocket_enabled')} />
            </Field>
          )}
          <Field label={<>密钥 {isEdit && <span className='text-ui-text-3 text-xs'>(留空不修改)</span>}</>}
            hint={mode === 'batch' ? '每行一个 key，将创建多个渠道' : mode === 'multi_to_single' ? '每行一个 key，合并为一个渠道' : '请输入渠道对应的鉴权密钥'}>
            <Textarea value={form.key || ''} onChange={u('key')} rows={mode !== 'single' || isMultiKey ? 5 : 2} placeholder='sk-...' width='full' />
          </Field>
          {!isEdit && mode === 'batch' && (
            <label className='flex items-center gap-2 text-sm text-ui-text-2 cursor-pointer'>
              <Switch size='sm' checked={batchPrefix} onChange={setBatchPrefix} />
              将 key 前缀追加到渠道名称
            </label>
          )}
          {(mode === 'multi_to_single' || (isEdit && isMultiKey)) && (
            <Field label='多 Key 模式'>
              <Select value={form.multi_key_mode || 'random'} onChange={u('multi_key_mode')} options={MULTI_KEY_MODE_OPTIONS} width='full' />
            </Field>
          )}
          {isOpenAI && (
            <Field label='组织' hint='不填则为默认组织'>
              <Input value={form.openai_organization || ''} onChange={u('openai_organization')} width='full' placeholder='org-xxx' />
            </Field>
          )}
          <Field label='API 地址' hint='末尾不要带 /v1 和 /，留空使用默认'>
            <Input value={form.base_url || ''} onChange={u('base_url')} placeholder='https://api.example.com' width='full' />
          </Field>
          {needsOther && (
            <Field label={isAzure ? 'API Version' : isVertex ? '区域配置 (JSON)' : isCoze ? 'Bot ID' : 'API Version'}
              hint={isAzure ? '如 2024-02-01' : isVertex ? '如 {"default":"us-central1"}' : ''}>
              <Input value={form.other || ''} onChange={u('other')} width='full'
                placeholder={isAzure ? '2024-02-01' : isVertex ? '{"default":"us-central1"}' : isCoze ? 'bot_xxx' : ''} />
            </Field>
          )}
          {isAWS && (
            <Field label='AWS 接口' hint='Mantle 使用原生 Messages；凭据格式为 APIKey|Region 或 AccessKey|SecretAccessKey|Region。'>
              <Select value={form.other_settings?.aws_api_type || 'invoke_model'} onChange={uOther('aws_api_type')} width='full'
                options={[{ value: 'invoke_model', label: 'InvokeModel（默认）' }, { value: 'mantle', label: 'Mantle Messages' }]} />
            </Field>
          )}
          {isAWS && (
            <Field label='AWS Key 类型'>
              <Select value={form.other_settings?.aws_key_type || 'ak_sk'} onChange={uOther('aws_key_type')} width='full'
                options={[{ value: 'ak_sk', label: 'AK/SK' }, { value: 'api_key', label: 'API Key' }]} />
            </Field>
          )}
          {isVertex && (
            <Field label='Vertex Key 类型'>
              <Select value={form.other_settings?.vertex_key_type || 'json'} onChange={uOther('vertex_key_type')} width='full'
                options={[{ value: 'json', label: 'JSON 凭证' }, { value: 'api_key', label: 'API Key' }]} />
            </Field>
          )}
          {isVertex && form.other_settings?.vertex_key_type === 'api_key' && (
            <Field label='Vertex Project ID' hint='可选。普通 Vertex API Key 填写所属项目；Express 模式可留空。'>
              <Input value={form.other_settings?.vertex_project_id || ''} onChange={uOther('vertex_project_id')} width='full' />
            </Field>
          )}
        </Section>

        {/* 模型配置 */}
        <Section title='模型配置'>
          <Field label={
            <div className='flex items-center justify-between w-full'>
              <span>支持模型</span>
              <div className='flex items-center gap-3'>
                {isEdit && (
                  <button onClick={fetchModels} disabled={fetchingModels}
                    className='text-xs text-ui-text-2 hover:text-ui-text cursor-pointer underline'>
                    {fetchingModels ? '获取中…' : '获取模型列表'}
                  </button>
                )}
                {!isEdit && MODEL_FETCHABLE_CHANNEL_TYPES.has(form.type) && (
                  <button onClick={fetchModelsFromUrl} disabled={fetchingModels}
                    className='text-xs text-ui-text-2 hover:text-ui-text cursor-pointer underline'>
                    {fetchingModels ? '获取中…' : '从上游拉取'}
                  </button>
                )}
                <button onClick={fillDefaultModels} className='text-xs text-ui-text-2 hover:text-ui-text cursor-pointer underline'>填入默认模型</button>
                <button onClick={clearModels} className='text-xs text-ui-text-2 hover:text-ui-text cursor-pointer underline'>清除所有</button>
              </div>
            </div>
          } hint=''>
            <ModelTagList
              models={form.models || ''}
              onChange={(v) => setForm((p) => ({ ...p, models: v }))}
            />
          </Field>
          <Field label='自定义模型名称'>
            <div className='flex items-center gap-2'>
              <Input value={customModel} onChange={setCustomModel} width='full' placeholder='输入自定义模型名称'
                onKeyDown={(e) => e.key === 'Enter' && addCustomModel()} />
              <Button variant='toggle' onClick={addCustomModel} style={{ flexShrink: 0 }}>填入</Button>
            </div>
          </Field>
          <Field label='分组'>
            <MultiSelect
              options={groupOptions}
              value={form.group ? form.group.split(',').map((s) => s.trim()).filter(Boolean) : []}
              onChange={(arr) => setForm((p) => ({ ...p, group: arr.join(',') }))}
              placeholder='选择分组'
              width='full'
            />
          </Field>
          <Field label='模型重定向'>
            <KeyValueEditor value={form.model_mapping || ''} onChange={u('model_mapping')}
              keyPlaceholder='请求模型名' valuePlaceholder='替换模型名'
              hint='键为请求中的模型名称，值为要替换的模型名称' />
          </Field>
          <Field label='是否自动禁用' hint='仅当系统设置中自动禁用开启时有效'>
            <Select value={form.auto_ban ?? 1} onChange={(v) => u('auto_ban')(Number(v))} width='full'
              options={[{ value: 1, label: '是（异常时自动禁用）' }, { value: 0, label: '否（不自动禁用）' }]} />
          </Field>
        </Section>

        {/* 高级设置 */}
        <Section title='高级设置' collapsible>
          {/* 上游模型管理 */}
          <div className='space-y-3 pb-3 border-b border-[#eeeeee]'>
            <span className='text-xs font-medium text-ui-text-2'>上游模型管理</span>
            <label className='flex items-center gap-2 text-sm text-ui-text-2 cursor-pointer'>
              <Switch size='sm' checked={!!form.other_settings?.upstream_model_update_check_enabled} onChange={(v) => uOther('upstream_model_update_check_enabled')(v)} />
              检测上游模型更新
            </label>
            <p className='text-xs text-ui-text-3 ml-6 -mt-1'>开启后由后端定时任务检测该渠道上游模型变化</p>
            <label className='flex items-center gap-2 text-sm text-ui-text-2 cursor-pointer'>
              <Switch size='sm' checked={!!form.other_settings?.upstream_model_update_auto_sync_enabled} onChange={(v) => uOther('upstream_model_update_auto_sync_enabled')(v)} />
              自动同步上游模型更新
            </label>
            <p className='text-xs text-ui-text-3 ml-6 -mt-1'>开启后检测到新增模型会自动加入当前渠道模型列表</p>
            <Field label='已忽略模型' hint='支持 regex: 前缀正则匹配'>
              <Input value={(form.other_settings?.upstream_model_update_ignored_models || []).join(',')}
                onChange={(v) => uOther('upstream_model_update_ignored_models')(v ? v.split(',').map((s) => s.trim()) : [])}
                width='full' placeholder='gpt-4.1-nano,regex:^sora-.*$' />
            </Field>
          </div>

          {/* 请求配置 */}
          <div className='space-y-4 pb-3 border-b border-[#eeeeee]'>
            <span className='text-xs font-medium text-ui-text-2'>请求配置</span>
            <Field label='参数覆盖'>
              <KeyValueEditor value={form.param_override || ''} onChange={u('param_override')}
                keyPlaceholder='参数名' valuePlaceholder='参数值'
                hint='用于覆盖请求参数，不支持覆盖 stream 参数' />
            </Field>
            <Field label='请求头覆盖'>
              <KeyValueEditor value={form.header_override || ''} onChange={u('header_override')}
                keyPlaceholder='Header 名' valuePlaceholder='Header 值'
                hint='支持变量：渠道密钥 {api_key}' />
            </Field>
            <Field label='状态码复写'>
              <KeyValueEditor value={form.status_code_mapping || ''} onChange={u('status_code_mapping')}
                keyPlaceholder='原状态码' valuePlaceholder='复写状态码'
                hint='键为原状态码，值为要复写的状态码，仅影响本地判断' />
            </Field>
          </div>

          {/* 渠道行为 */}
          <div className='space-y-4 pb-3 border-b border-[#eeeeee]'>
            <span className='text-xs font-medium text-ui-text-2'>渠道行为</span>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <Field label='渠道标签'>
                <Input value={form.tag || ''} onChange={u('tag')} width='full' placeholder='可选' />
              </Field>
              <Field label='测试模型'>
                <Input value={form.test_model || ''} onChange={u('test_model')} width='full' placeholder='留空使用第一个' />
              </Field>
            </div>
            <Field label='备注' hint='仅管理员可见'>
              <Textarea value={form.remark || ''} onChange={u('remark')} rows={2} placeholder='请输入备注' width='full' />
            </Field>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
              <Field label='优先级'>
                <NumberInput value={form.priority ?? 0} onChange={(v) => u('priority')(Number(v))} width='full' />
              </Field>
              <Field label='权重'>
                <NumberInput value={form.weight ?? 0} onChange={(v) => u('weight')(Number(v))} width='full' />
              </Field>
              <Field label='状态'>
                <Select value={form.status || 1} onChange={(v) => u('status')(Number(v))} width='full'
                  options={[{ value: 1, label: '启用' }, { value: 2, label: '禁用' }]} />
              </Field>
            </div>
          </div>

          {/* 字段透传控制 */}
          <div className='space-y-3 pb-3 border-b border-[#eeeeee]'>
            <span className='text-xs font-medium text-ui-text-2'>字段透传控制</span>
            <label className='flex items-start gap-2 text-sm text-ui-text-2 cursor-pointer'>
              <Switch size='sm' checked={!!form.other_settings?.allow_service_tier} onChange={(v) => uOther('allow_service_tier')(v)} />
              <div>
                <div>允许 service_tier 透传</div>
                <p className='text-xs text-ui-text-3 mt-0.5'>允许透传可能导致实际计费高于预期</p>
              </div>
            </label>
            <label className='flex items-start gap-2 text-sm text-ui-text-2 cursor-pointer'>
              <Switch size='sm' checked={!!form.other_settings?.disable_store} onChange={(v) => uOther('disable_store')(v)} />
              <div>
                <div>禁用 store 透传</div>
                <p className='text-xs text-ui-text-3 mt-0.5'>开启后可能导致 Codex 无法正常使用</p>
              </div>
            </label>
            <label className='flex items-start gap-2 text-sm text-ui-text-2 cursor-pointer'>
              <Switch size='sm' checked={!!form.other_settings?.allow_safety_identifier} onChange={(v) => uOther('allow_safety_identifier')(v)} />
              <div>
                <div>允许 safety_identifier 透传</div>
                <p className='text-xs text-ui-text-3 mt-0.5'>默认关闭以保护用户隐私</p>
              </div>
            </label>
            <label className='flex items-start gap-2 text-sm text-ui-text-2 cursor-pointer'>
              <Switch size='sm' checked={!!form.other_settings?.allow_include_obfuscation} onChange={(v) => uOther('allow_include_obfuscation')(v)} />
              <div>
                <div>允许 stream_options.include_obfuscation 透传</div>
                <p className='text-xs text-ui-text-3 mt-0.5'>默认关闭以避免客户端关闭安全保护</p>
              </div>
            </label>
            {isClaude && (
              <>
                <label className='flex items-center gap-2 text-sm text-ui-text-2 cursor-pointer'>
                  <Switch size='sm' checked={!!form.other_settings?.claude_beta_query} onChange={(v) => uOther('claude_beta_query')(v)} />
                  Claude Beta Query (?beta=true)
                </label>
                <label className='flex items-center gap-2 text-sm text-ui-text-2 cursor-pointer'>
                  <Switch size='sm' checked={!!form.other_settings?.allow_inference_geo} onChange={(v) => uOther('allow_inference_geo')(v)} />
                  允许 inference_geo 透传
                </label>
                <label className='flex items-center gap-2 text-sm text-ui-text-2 cursor-pointer'>
                  <Switch size='sm' checked={!!form.other_settings?.allow_speed} onChange={(v) => uOther('allow_speed')(v)} />
                  允许 speed 参数透传
                </label>
              </>
            )}
            {isOpenRouter && (
              <label className='flex items-center gap-2 text-sm text-ui-text-2 cursor-pointer'>
                <Switch size='sm' checked={!!form.other_settings?.openrouter_enterprise} onChange={(v) => uOther('openrouter_enterprise')(v)} />
                OpenRouter Enterprise 模式
              </label>
            )}
            {isAzure && (
              <Field label='Azure Responses API Version'>
                <Input value={form.other_settings?.azure_responses_version || ''} onChange={uOther('azure_responses_version')} width='full' placeholder='2024-02-01' />
              </Field>
            )}
          </div>

          {/* 额外设置 */}
          <div className='space-y-4'>
            <span className='text-xs font-medium text-ui-text-2'>额外设置</span>
            <label className='flex items-start gap-2 text-sm text-ui-text-2 cursor-pointer'>
              <Switch size='sm' checked={!!form.setting?.ForceFormat} onChange={(v) => uSetting('ForceFormat')(v)} />
              <div>
                <div>强制格式化</div>
                <p className='text-xs text-ui-text-3 mt-0.5'>强制将响应格式化为 OpenAI 标准格式</p>
              </div>
            </label>
            <label className='flex items-start gap-2 text-sm text-ui-text-2 cursor-pointer'>
              <Switch size='sm' checked={!!form.setting?.ThinkingToContent} onChange={(v) => uSetting('ThinkingToContent')(v)} />
              <div>
                <div>思考内容转换</div>
                <p className='text-xs text-ui-text-3 mt-0.5'>将 reasoning_content 转换为 &lt;think&gt; 标签拼接到内容中</p>
              </div>
            </label>
            <label className='flex items-start gap-2 text-sm text-ui-text-2 cursor-pointer'>
              <Switch size='sm' checked={!!form.setting?.PassThroughBodyEnabled} onChange={(v) => uSetting('PassThroughBodyEnabled')(v)} />
              <div>
                <div>透传请求体</div>
                <p className='text-xs text-ui-text-3 mt-0.5'>启用请求体透传功能</p>
              </div>
            </label>
            <Field label='代理地址' hint='支持 socks5 协议'>
              <Input value={form.setting?.Proxy || ''} onChange={uSetting('Proxy')} width='full' placeholder='socks5://user:pass@host:port' />
            </Field>
            <Field label='系统提示词'>
              <Textarea value={form.setting?.SystemPrompt || ''} onChange={uSetting('SystemPrompt')} rows={3} placeholder='输入系统提示词' width='full' />
            </Field>
            <label className='flex items-start gap-2 text-sm text-ui-text-2 cursor-pointer'>
              <Switch size='sm' checked={!!form.setting?.SystemPromptOverride} onChange={(v) => uSetting('SystemPromptOverride')(v)} />
              <div>
                <div>系统提示词覆盖</div>
                <p className='text-xs text-ui-text-3 mt-0.5'>用户优先：如果用户请求中指定了系统提示词，将优先使用用户的设置。关闭则拼接到用户提示词前面</p>
              </div>
            </label>
          </div>
        </Section>
      </div>
    </SlideOver>
  );
};

const ModelTagList = ({ models, onChange }) => {
  const list = models ? models.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const remove = (idx) => {
    const next = list.filter((_, i) => i !== idx);
    onChange(next.join(','));
  };

  if (list.length === 0) {
    return <p className='text-xs text-ui-text-3 py-2'>暂无模型，请通过上方按钮添加或手动输入</p>;
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 0', maxHeight: 180, overflowY: 'auto' }}>
      {list.map((m, i) => (
        <span key={`${m}-${i}`} style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          height: 26, paddingInline: 10, borderRadius: 13,
          fontSize: 12, color: 'var(--ui-text)', background: 'var(--ui-bg-subtle)',
        }}>
          {m}
          <button onClick={() => remove(i)} style={{ cursor: 'pointer', border: 'none', background: 'none', color: 'var(--ui-text-3)', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
        </span>
      ))}
    </div>
  );
};

const Section = ({ title, collapsible, children }) => {
  const [open, setOpen] = useState(!collapsible);
  return (
    <div>
      <div
        className={cn('flex items-center gap-2 mb-3', collapsible && 'cursor-pointer')}
        onClick={collapsible ? () => setOpen((o) => !o) : undefined}
      >
        <span className='text-sm font-medium text-ui-text'>{title}</span>
        <div className='flex-1 h-px bg-[#eeeeee]' />
        {collapsible && (
          <ChevronDown size={14} className='text-ui-text-3' style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        )}
      </div>
      {open && <div className='space-y-4'>{children}</div>}
    </div>
  );
};

const Field = ({ label, hint, children }) => (
  <div>
    <label className='block text-sm text-ui-text-2 mb-1.5'>
      {typeof label === 'string' ? label : label}
      {hint && <span className='text-xs text-ui-text-3 ml-1.5'>({hint})</span>}
    </label>
    {children}
  </div>
);

export default ChannelPage;

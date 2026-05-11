/*
 * ChannelsPage — 渠道管理（简化版，与 web-backup 同样的页面骨架）
 *
 * Notice + 筛选/操作 Card + 渠道表格 + Pagination
 * 14 个高级 Modal 暂以占位 ConfirmDialog/Notice 代替（编辑/删除/状态切换/测试/同步余额已实现）。
 */

import React, { useState } from 'react';
import { AlertTriangle, Plus, RefreshCw, Pencil, Trash2, FlaskConical, RotateCw } from 'lucide-react';
import { useChannelsData } from '../../../hooks/channels/useChannelsData';
import {
  Card, Button, IconButton, Pagination, Input, Select, Switch, Tag, Notice,
  Modal, ConfirmDialog, FieldRow, Textarea, NumberInput, Tabs,
} from '../../ui';
import { API, showError, showSuccess, renderQuota } from '../../../helpers';
import TableActionBtn from '../table/TableActionBtn';
import { cn } from '../../ui/tokens';

const STATUS_TONE  = { 1: 'success', 2: 'default', 3: 'warning' };
const STATUS_LABEL = { 1: '启用', 2: '手动禁用', 3: '自动禁用' };

const ChannelsPage = () => {
  const channelsData = useChannelsData();
  const {
    channels, channelCount, activePage, pageSize, loading, t,
    handlePageChange, handlePageSizeChange, refresh,
    showEdit, editingChannel, setShowEdit, setEditingChannel, closeEdit,
    globalPassThroughEnabled, enableTagMode, setEnableTagMode,
  } = channelsData;

  const [keyword, setKeyword] = useState('');
  const [deleting, setDeleting] = useState(null);

  const toggleStatus = async (r) => {
    try {
      await API.put('/api/channel/', { id: r.id, status: r.status === 1 ? 2 : 1 });
      showSuccess(t('已更新')); refresh();
    } catch (e) { showError(e); }
  };
  const onTest = async (r) => {
    try {
      const res = await API.get(`/api/channel/test/${r.id}/`);
      if (res.data?.success) showSuccess(`${t('测试通过')}（${res.data.time?.toFixed?.(2) ?? '?'} s）`);
      else showError(res.data?.message || t('测试失败'));
    } catch (e) { showError(e); }
  };
  const onSyncBalance = async (r) => {
    try {
      const res = await API.get(`/api/channel/update_balance/${r.id}/`);
      if (res.data?.success) { showSuccess(t('已同步余额')); refresh(); }
      else showError(res.data?.message || t('同步失败'));
    } catch (e) { showError(e); }
  };
  const onDelete = async () => {
    if (!deleting) return;
    try {
      await API.delete(`/api/channel/${deleting.id}/`);
      showSuccess(t('已删除')); setDeleting(null); refresh();
    } catch (e) { showError(e); }
  };

  return (
    <div className='px-4 pt-8 pb-6 md:px-6 md:pt-10 md:pb-8 overflow-x-hidden' style={{ backgroundColor: 'var(--page-bg)' }}>
      <div className='max-w-[1400px] mx-auto'>
        <div className='flex items-center justify-between gap-3 mb-5'>
          <h1 className='text-2xl font-semibold text-ui-text' style={{ letterSpacing: '-0.02em' }}>{t('渠道管理')}</h1>
        </div>

        {globalPassThroughEnabled && (
          <div className='flex items-start gap-2 px-5 py-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 mb-3'>
            <AlertTriangle size={16} className='text-amber-500 flex-shrink-0 mt-0.5' />
            <div className='text-[13px] text-ui-text-2 leading-relaxed'>
              {t('已开启全局请求透传：参数覆写、模型重定向、渠道适配等 NewAPI 内置功能将失效，非最佳实践；如因此产生问题，请勿提交 issue 反馈。')}
            </div>
          </div>
        )}

        <Card>
          <div className='flex items-center justify-between gap-2'>
            <div className='flex items-center gap-2'>
              <Input value={keyword} onChange={setKeyword} placeholder={t('搜索 ID / 名称 / Key')} width={320} />
              <Button onClick={() => refresh()}>{t('搜索')}</Button>
            </div>
            <div className='flex items-center gap-2'>
              <IconButton icon={RefreshCw} onClick={refresh} disabled={loading} />
              <Button icon={Plus} onClick={() => { setEditingChannel({ id: undefined, name: '', type: 1, key: '', base_url: '', models: '', groups: 'default', priority: 0, weight: 0 }); setShowEdit(true); }}>
                {t('新建渠道')}
              </Button>
            </div>
          </div>
        </Card>
        <div className='h-3' />

        {!enableTagMode && (
          <div className='mb-3'>
            <Tabs
              variant='underline'
              value='all'
              onChange={() => {}}
              items={[{ value: 'all', label: t('全部') }, { value: 'enabled', label: t('启用中') }, { value: 'disabled', label: t('已禁用') }]}
            />
          </div>
        )}

        <Card noPadding>
          <div className='overflow-x-auto'>
            <table className='w-full text-sm' style={{ minWidth: '1100px' }}>
              <thead>
                <tr className='border-b border-ui-border bg-ui-bg-subtle/50 text-[11px] uppercase tracking-wider text-ui-text-3'>
                  <th className='text-left px-3 py-2.5 font-medium w-16'>ID</th>
                  <th className='text-left px-3 py-2.5 font-medium min-w-[180px]'>{t('名称')}</th>
                  <th className='text-left px-3 py-2.5 font-medium min-w-[100px]'>{t('类型')}</th>
                  <th className='text-left px-3 py-2.5 font-medium min-w-[120px]'>{t('分组')}</th>
                  <th className='text-right px-3 py-2.5 font-medium min-w-[80px]'>{t('优先级')}</th>
                  <th className='text-right px-3 py-2.5 font-medium min-w-[80px]'>{t('权重')}</th>
                  <th className='text-right px-3 py-2.5 font-medium min-w-[100px]'>{t('已用')}</th>
                  <th className='text-left px-3 py-2.5 font-medium min-w-[100px]'>{t('状态')}</th>
                  <th className='text-right px-3 py-2.5 font-medium min-w-[280px]'>{t('操作')}</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? <tr><td colSpan={9} className='py-12 text-center text-ui-text-3 text-sm'>{t('加载中...')}</td></tr>
                  : channels.length === 0
                    ? <tr><td colSpan={9} className='py-12 text-center text-ui-text-3 text-sm'>{t('暂无渠道')}</td></tr>
                    : channels.map((r) => (
                      <tr key={r.id} className='border-b border-ui-divider last:border-b-0 hover:bg-ui-bg-subtle/40 transition-colors'>
                        <td className='px-3 py-3 align-middle text-xs text-ui-text-3 tabular-nums'>#{r.id}</td>
                        <td className='px-3 py-3 align-middle text-sm text-ui-text'>{r.name}</td>
                        <td className='px-3 py-3 align-middle text-xs text-ui-text-2'>{r.type}</td>
                        <td className='px-3 py-3 align-middle text-xs text-ui-text-2'>{r.group || '-'}</td>
                        <td className='px-3 py-3 align-middle text-right text-xs tabular-nums'>{r.priority ?? 0}</td>
                        <td className='px-3 py-3 align-middle text-right text-xs tabular-nums'>{r.weight ?? 0}</td>
                        <td className='px-3 py-3 align-middle text-right text-xs tabular-nums'>{renderQuota(r.used_quota || 0)}</td>
                        <td className='px-3 py-3 align-middle'><Tag tone={STATUS_TONE[r.status]}>{t(STATUS_LABEL[r.status] || '-')}</Tag></td>
                        <td className='px-3 py-3 align-middle text-right'>
                          <div className='flex items-center justify-end gap-1'>
                            <Switch size='sm' checked={r.status === 1} onChange={() => toggleStatus(r)} />
                            <TableActionBtn onClick={() => onTest(r)}><FlaskConical size={11} />{t('测试')}</TableActionBtn>
                            <TableActionBtn onClick={() => onSyncBalance(r)}><RotateCw size={11} />{t('余额')}</TableActionBtn>
                            <TableActionBtn onClick={() => { setEditingChannel({ ...r }); setShowEdit(true); }}><Pencil size={11} />{t('编辑')}</TableActionBtn>
                            <TableActionBtn danger onClick={() => setDeleting(r)}><Trash2 size={11} />{t('删除')}</TableActionBtn>
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          <div className='border-t border-ui-divider'>
            <Pagination
              page={activePage} pageSize={pageSize} total={channelCount}
              pageSizeOpts={[10, 20, 50, 100]}
              onChange={handlePageChange} onPageSizeChange={handlePageSizeChange}
            />
          </div>
        </Card>

        <div className='mt-3'>
          <Notice kind='info'>
            {t('批量打标签 / 多 Key 管理 / 上游同步 / 参数覆写 / 列选择器等高级功能正在迁移中。')}
          </Notice>
        </div>
      </div>

      <ChannelEditModal
        visible={showEdit}
        channel={editingChannel}
        onClose={closeEdit}
        onSaved={() => { closeEdit(); refresh(); }}
        t={t}
      />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={onDelete}
        title={t('删除渠道')}
        description={`${t('确定删除')}「${deleting?.name}」?`}
      />
    </div>
  );
};

const ChannelEditModal = ({ visible, channel, onClose, onSaved, t }) => {
  const [form, setForm] = useState(channel || {});
  const [saving, setSaving] = useState(false);
  React.useEffect(() => { if (channel) setForm({ ...channel }); }, [channel]);
  const set = (k) => (v) => setForm((s) => ({ ...s, [k]: v }));

  const onSave = async () => {
    if (!form.name?.trim()) { showError(t('请填写名称')); return; }
    setSaving(true);
    try {
      const isNew = form.id === undefined;
      const payload = { ...form, type: Number(form.type || 1), priority: Number(form.priority || 0), weight: Number(form.weight || 0) };
      const res = isNew ? await API.post('/api/channel/', payload) : await API.put('/api/channel/', payload);
      if (res.data?.success) { showSuccess(t('已保存')); onSaved(); }
      else showError(res.data?.message || t('保存失败'));
    } catch (e) { showError(e); }
    finally { setSaving(false); }
  };

  if (!form) return null;
  return (
    <Modal open={!!visible} onClose={onClose} title={form.id === undefined ? t('新建渠道') : t('编辑渠道')} width={640} loading={saving} onConfirm={onSave}>
      <FieldRow label={t('名称')} required>
        <Input value={form.name || ''} onChange={set('name')} placeholder={t('例如：OpenAI 主线')} />
      </FieldRow>
      <FieldRow label={t('类型 (channel_type 数值)')}>
        <NumberInput value={form.type ?? 1} onChange={set('type')} min={1} />
      </FieldRow>
      <FieldRow label='Base URL'>
        <Input value={form.base_url || ''} onChange={set('base_url')} placeholder={t('留空使用默认')} />
      </FieldRow>
      <FieldRow label='Key'>
        <Textarea value={form.key || ''} onChange={set('key')} rows={3} placeholder={t('单 Key 或多 Key（每行一个）')} />
      </FieldRow>
      <FieldRow label={t('支持模型 (逗号分隔)')}>
        <Textarea value={form.models || ''} onChange={set('models')} rows={3} />
      </FieldRow>
      <FieldRow label={t('分组 (逗号分隔)')}>
        <Input value={form.group || ''} onChange={set('group')} />
      </FieldRow>
      <div className='grid grid-cols-2 gap-3'>
        <FieldRow label={t('优先级')}>
          <NumberInput value={form.priority ?? 0} onChange={set('priority')} />
        </FieldRow>
        <FieldRow label={t('权重')}>
          <NumberInput value={form.weight ?? 0} onChange={set('weight')} />
        </FieldRow>
      </div>
    </Modal>
  );
};

export default ChannelsPage;

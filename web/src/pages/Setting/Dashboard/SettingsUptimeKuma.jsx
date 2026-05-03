/*
 * Uptime Kuma 监控分类管理 — token-system rewrite.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, Edit, Trash2 } from 'lucide-react';
import { API, showError, showSuccess } from '../../../helpers';
import CrudSection from '../../../components/common/table/CrudSection';
import ModalDialog from '../../../components/common/ModalDialog';
import { showConfirm } from '../../../components/common/ConfirmDialog';

const SettingsUptimeKuma = ({ options, refresh }) => {
  const { t } = useTranslation();
  const [list, setList] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [form, setForm] = useState({ categoryName: '', url: '', slug: '' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState([]);
  const [panelEnabled, setPanelEnabled] = useState(true);

  useEffect(() => {
    const str = options['console_setting.uptime_kuma_groups'];
    if (str !== undefined) {
      try {
        const parsed = JSON.parse(str);
        const arr = Array.isArray(parsed) ? parsed : [];
        setList(arr.map((item, i) => ({ ...item, id: item.id || i + 1 })));
      } catch { setList([]); }
    }
  }, [options['console_setting.uptime_kuma_groups']]);

  useEffect(() => {
    const v = options['console_setting.uptime_kuma_enabled'];
    setPanelEnabled(v === undefined ? true : v === 'true' || v === true);
  }, [options['console_setting.uptime_kuma_enabled']]);

  const handleToggleEnabled = async (checked) => {
    try {
      const res = await API.put('/api/option/', {
        key: 'console_setting.uptime_kuma_enabled',
        value: checked ? 'true' : 'false',
      });
      if (res.data.success) { setPanelEnabled(checked); showSuccess(t('设置已保存')); refresh?.(); }
      else showError(res.data.message);
    } catch (err) { showError(err.message); }
  };

  const submitAll = async () => {
    setLoading(true);
    try {
      const res = await API.put('/api/option/', { key: 'console_setting.uptime_kuma_groups', value: JSON.stringify(list) });
      if (res.data.success) { showSuccess(t('Uptime Kuma 配置已更新')); setHasChanges(false); refresh?.(); }
      else showError(res.data.message);
    } catch { showError(t('Uptime Kuma 配置更新失败')); }
    finally { setLoading(false); }
  };

  const openAdd = () => { setEditing(null); setForm({ categoryName: '', url: '', slug: '' }); setShowModal(true); };
  const openEdit = (record) => { setEditing(record); setForm({ categoryName: record.categoryName, url: record.url, slug: record.slug }); setShowModal(true); };

  const handleSave = () => {
    if (!form.categoryName || !form.url || !form.slug) return showError(t('请填写完整的分类信息'));
    try { new URL(form.url); } catch { return showError(t('请输入有效的 URL 地址')); }
    if (!/^[a-zA-Z0-9_-]+$/.test(form.slug)) return showError(t('Slug 只能包含字母、数字、下划线和连字符'));
    setModalLoading(true);
    let newList;
    if (editing) {
      newList = list.map((item) => (item.id === editing.id ? { ...item, ...form } : item));
    } else {
      const newId = Math.max(...list.map((item) => item.id), 0) + 1;
      newList = [...list, { id: newId, ...form }];
    }
    setList(newList); setHasChanges(true); setShowModal(false); setModalLoading(false);
    showSuccess(editing ? t('分类已更新') : t('分类已添加'));
  };

  const handleDelete = (record) => {
    showConfirm({
      title: t('确认删除'), content: t('确定要删除此分类吗？'), danger: true, okText: t('确认删除'),
      onOk: () => { setList((prev) => prev.filter((item) => item.id !== record.id)); setHasChanges(true); showSuccess(t('分类已删除')); },
    });
  };

  const handleBatchDelete = () => {
    if (!selected.length) return;
    showConfirm({
      title: t('批量删除'), content: `${t('确定要删除')} ${selected.length} ${t('个分类吗？')}`, danger: true, okText: t('确认删除'),
      onOk: () => { setList((prev) => prev.filter((item) => !selected.includes(item.id))); setSelected([]); setHasChanges(true); showSuccess(`${t('已删除')} ${selected.length} ${t('个分类')}`); },
    });
  };

  const paged = list.slice((page - 1) * pageSize, page * pageSize);

  const columns = [
    {
      key: 'categoryName', title: t('分类名称'), dataIndex: 'categoryName',
      render: (text) => <div className='font-semibold'>{text}</div>,
    },
    {
      key: 'url', title: t('Uptime Kuma 地址'), dataIndex: 'url',
      render: (text) => <span className='font-mono text-xs text-blue-600 dark:text-blue-400 truncate max-w-[260px] inline-block'>{text}</span>,
    },
    {
      key: 'slug', title: t('状态页面 Slug'), dataIndex: 'slug',
      render: (text) => <span className='font-mono text-xs text-ui-text-2'>{text}</span>,
    },
    {
      key: 'action', title: t('操作'), width: 130,
      render: (_, row) => (
        <div className='flex items-center gap-1'>
          <button onClick={() => openEdit(row)} className='inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border border-ui-border text-ui-text-2 hover:bg-ui-bg-hover'>
            <Edit size={11} /> {t('编辑')}
          </button>
          <button onClick={() => handleDelete(row)} className='inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border border-ui-danger/30 text-ui-danger hover:bg-ui-danger-bg'>
            <Trash2 size={11} /> {t('删除')}
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <CrudSection
        title={t('Uptime Kuma 监控分类管理')}
        hint={t('可以配置多个监控分类用于服务状态展示（最多 20 个）')}
        icon={Activity}
        iconColor='emerald'
        columns={columns}
        dataSource={paged}
        loading={loading}
        page={page}
        pageSize={pageSize}
        total={list.length}
        onPageChange={setPage}
        selectedRowKeys={selected}
        onSelectionChange={setSelected}
        onAdd={openAdd}
        addLabel={t('添加分类')}
        onBatchDelete={handleBatchDelete}
        onSave={submitAll}
        saveDisabled={!hasChanges}
        saveLoading={loading}
        enabled={panelEnabled}
        onToggleEnabled={handleToggleEnabled}
        emptyLabel={t('暂无监控数据')}
      />

      <ModalDialog
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? t('编辑分类') : t('添加分类')}
        loading={modalLoading}
        width={500}
        footer={
          <div className='flex justify-end gap-2'>
            <button onClick={() => setShowModal(false)} className='px-3.5 py-1.5 text-xs rounded-md border border-ui-border text-ui-text-2 hover:bg-ui-bg-subtle'>{t('取消')}</button>
            <button onClick={handleSave} disabled={modalLoading} className='px-3.5 py-1.5 text-xs font-semibold rounded-md bg-ui-accent text-ui-accent-fg hover:opacity-90 disabled:opacity-50'>{t('保存')}</button>
          </div>
        }
      >
        <div>
          <label className='text-xs font-medium text-ui-text-2 block mb-1'>{t('分类名称')} *</label>
          <input
            type='text' value={form.categoryName}
            onChange={(e) => setForm({ ...form, categoryName: e.target.value })}
            placeholder={t('如：OpenAI、Claude 等')}
            maxLength={50}
            className='w-full rounded-md border border-ui-border bg-ui-bg-subtle text-ui-text text-xs px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ui-accent/40'
          />
        </div>
        <div>
          <label className='text-xs font-medium text-ui-text-2 block mb-1'>{t('Uptime Kuma 地址')} *</label>
          <input
            type='url' value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder='https://status.example.com'
            maxLength={500}
            className='w-full rounded-md border border-ui-border bg-ui-bg-subtle text-ui-text text-xs px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ui-accent/40'
          />
        </div>
        <div>
          <label className='text-xs font-medium text-ui-text-2 block mb-1'>{t('状态页面 Slug')} *</label>
          <input
            type='text' value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder='my-status'
            maxLength={100}
            className='w-full rounded-md border border-ui-border bg-ui-bg-subtle text-ui-text text-xs px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ui-accent/40'
          />
        </div>
      </ModalDialog>
    </>
  );
};

export default SettingsUptimeKuma;

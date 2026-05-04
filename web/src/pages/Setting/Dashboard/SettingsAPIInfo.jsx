/*
 * API 信息管理 — token-system rewrite.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../../helpers';
import { NativeSelect } from '../../../components/common/form/Primitives';
import CrudSection from '../../../components/common/table/CrudSection';
import ModalDialog from '../../../components/common/ModalDialog';
import { showConfirm } from '../../../components/common/ConfirmDialog';

const COLOR_OPTIONS = [
  { value: 'blue', label: 'Blue' },
  { value: 'green', label: 'Green' },
  { value: 'cyan', label: 'Cyan' },
  { value: 'purple', label: 'Purple' },
  { value: 'pink', label: 'Pink' },
  { value: 'red', label: 'Red' },
  { value: 'orange', label: 'Orange' },
  { value: 'amber', label: 'Amber' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'lime', label: 'Lime' },
  { value: 'teal', label: 'Teal' },
  { value: 'indigo', label: 'Indigo' },
  { value: 'violet', label: 'Violet' },
  { value: 'grey', label: 'Grey' },
];

const COLOR_DOT_MAP = {
  blue: 'bg-blue-500', green: 'bg-emerald-500', cyan: 'bg-cyan-500',
  purple: 'bg-purple-500', pink: 'bg-pink-500', red: 'bg-red-500',
  orange: 'bg-orange-500', amber: 'bg-amber-500', yellow: 'bg-yellow-500',
  lime: 'bg-lime-500', teal: 'bg-teal-500', indigo: 'bg-indigo-500',
  violet: 'bg-violet-500', grey: 'bg-gray-400',
};

const SettingsAPIInfo = ({ options, refresh }) => {
  const { t } = useTranslation();
  const [list, setList] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [form, setForm] = useState({ url: '', description: '', route: '', color: 'blue' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState([]);
  const [panelEnabled, setPanelEnabled] = useState(true);

  useEffect(() => {
    const str = options['console_setting.api_info'] ?? options.ApiInfo;
    if (str !== undefined) {
      try { setList(Array.isArray(JSON.parse(str)) ? JSON.parse(str) : []); } catch { setList([]); }
    }
  }, [options['console_setting.api_info'], options.ApiInfo]);

  useEffect(() => {
    const v = options['console_setting.api_info_enabled'];
    setPanelEnabled(v === undefined ? true : v === 'true' || v === true);
  }, [options['console_setting.api_info_enabled']]);

  const handleToggleEnabled = async (checked) => {
    try {
      const res = await API.put('/api/option/', {
        key: 'console_setting.api_info_enabled',
        value: checked ? 'true' : 'false',
      });
      if (res.data.success) { setPanelEnabled(checked); showSuccess(t('设置已保存')); refresh?.(); }
      else showError(res.data.message);
    } catch (err) { showError(err.message); }
  };

  const submitAll = async () => {
    setLoading(true);
    try {
      const res = await API.put('/api/option/', { key: 'console_setting.api_info', value: JSON.stringify(list) });
      if (res.data.success) { showSuccess(t('API 信息已更新')); setHasChanges(false); refresh?.(); }
      else showError(res.data.message);
    } catch { showError(t('API 信息更新失败')); }
    finally { setLoading(false); }
  };

  const openAdd = () => { setEditing(null); setForm({ url: '', description: '', route: '', color: 'blue' }); setShowModal(true); };
  const openEdit = (record) => { setEditing(record); setForm({ url: record.url, description: record.description, route: record.route, color: record.color }); setShowModal(true); };

  const handleSave = () => {
    if (!form.url || !form.route || !form.description) return showError(t('请填写完整的 API 信息'));
    setModalLoading(true);
    let newList;
    if (editing) {
      newList = list.map((r) => (r.id === editing.id ? { ...r, ...form } : r));
    } else {
      const newId = Math.max(...list.map((r) => r.id), 0) + 1;
      newList = [...list, { id: newId, ...form }];
    }
    setList(newList); setHasChanges(true); setShowModal(false); setModalLoading(false);
    showSuccess(editing ? t('API 信息已更新') : t('API 信息已添加'));
  };

  const handleDelete = (record) => {
    showConfirm({
      title: t('确认删除'), content: t('确定要删除此 API 信息吗？'), danger: true, okText: t('确认删除'),
      onOk: () => { setList((prev) => prev.filter((r) => r.id !== record.id)); setHasChanges(true); showSuccess(t('API 信息已删除')); },
    });
  };

  const handleBatchDelete = () => {
    if (!selected.length) return;
    showConfirm({
      title: t('批量删除'), content: `${t('确定要删除')} ${selected.length} ${t('个 API 信息吗？')}`, danger: true, okText: t('确认删除'),
      onOk: () => { setList((prev) => prev.filter((r) => !selected.includes(r.id))); setSelected([]); setHasChanges(true); showSuccess(`${t('已删除')} ${selected.length} ${t('个 API 信息')}`); },
    });
  };

  const paged = list.slice((page - 1) * pageSize, page * pageSize);

  const columns = [
    { key: 'id', title: 'ID', dataIndex: 'id', width: 50 },
    {
      key: 'url', title: t('API 地址'), dataIndex: 'url',
      render: (text, row) => (
        <span className='inline-flex items-center gap-1.5'>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${COLOR_DOT_MAP[row.color] || 'bg-gray-400'}`} />
          <span className='font-mono text-xs truncate max-w-[200px]'>{text}</span>
        </span>
      ),
    },
    { key: 'route', title: t('线路描述'), dataIndex: 'route', width: 120 },
    { key: 'description', title: t('说明'), dataIndex: 'description', render: (v) => <span className='text-ui-text-3 truncate max-w-[180px] inline-block'>{v || '-'}</span> },
    {
      key: 'color', title: t('颜色'), dataIndex: 'color', width: 60,
      render: (color) => <span className={`w-4 h-4 rounded-full inline-block border border-ui-border ${COLOR_DOT_MAP[color] || 'bg-gray-400'}`} />,
    },
    {
      key: 'action', title: t('操作'), width: 130,
      render: (_, row) => (
        <div className='flex items-center gap-1'>
          <button onClick={() => openEdit(row)} className='inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border border-ui-border text-ui-text-2 hover:bg-ui-bg-hover'>
            {t('编辑')}
          </button>
          <button onClick={() => handleDelete(row)} className='inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border border-ui-danger/30 text-ui-danger hover:bg-ui-danger-bg'>
            {t('删除')}
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <CrudSection
        title={t('API 信息管理')}
        hint={t('可以配置多个 API 地址用于状态展示和负载均衡（最多 50 个）')}columns={columns}
        dataSource={paged}
        loading={loading}
        page={page}
        pageSize={pageSize}
        total={list.length}
        onPageChange={setPage}
        selectedRowKeys={selected}
        onSelectionChange={setSelected}
        onAdd={openAdd}
        addLabel={t('添加 API')}
        onBatchDelete={handleBatchDelete}
        onSave={submitAll}
        saveDisabled={!hasChanges}
        saveLoading={loading}
        enabled={panelEnabled}
        onToggleEnabled={handleToggleEnabled}
        emptyLabel={t('暂无 API 信息')}
      />

      <ModalDialog
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? t('编辑 API') : t('添加 API')}
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
          <label className='text-xs font-medium text-ui-text-2 block mb-1'>{t('API 地址')} *</label>
          <input
            type='url' value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder='https://api.example.com'
            className='w-full rounded-md border border-ui-border bg-ui-bg-subtle text-ui-text text-xs px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ui-accent/40'
          />
        </div>
        <div>
          <label className='text-xs font-medium text-ui-text-2 block mb-1'>{t('线路描述')} *</label>
          <input
            type='text' value={form.route}
            onChange={(e) => setForm({ ...form, route: e.target.value })}
            placeholder={t('如：香港线路')}
            className='w-full rounded-md border border-ui-border bg-ui-bg-subtle text-ui-text text-xs px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ui-accent/40'
          />
        </div>
        <div>
          <label className='text-xs font-medium text-ui-text-2 block mb-1'>{t('说明')} *</label>
          <input
            type='text' value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder={t('如：大带宽批量分析图片推荐')}
            className='w-full rounded-md border border-ui-border bg-ui-bg-subtle text-ui-text text-xs px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ui-accent/40'
          />
        </div>
        <div>
          <label className='text-xs font-medium text-ui-text-2 block mb-1'>{t('标识颜色')}</label>
          <NativeSelect
            value={form.color}
            onChange={(v) => setForm({ ...form, color: v })}
            options={COLOR_OPTIONS}
          />
          <div className='flex items-center gap-2 mt-2'>
            <span className={`w-4 h-4 rounded-full inline-block border border-ui-border ${COLOR_DOT_MAP[form.color] || 'bg-gray-400'}`} />
            <span className='text-xs text-ui-text-3'>{form.color}</span>
          </div>
        </div>
      </ModalDialog>
    </>
  );
};

export default SettingsAPIInfo;

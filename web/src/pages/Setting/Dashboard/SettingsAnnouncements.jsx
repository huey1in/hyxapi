/*
 * 系统公告管理 — token-system rewrite.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  API,
  showError,
  showSuccess,
  getRelativeTime,
  formatDateTimeString,
} from '../../../helpers';
import { NativeSelect } from '../../../components/common/form/Primitives';
import CrudSection from '../../../components/common/table/CrudSection';
import ModalDialog from '../../../components/common/ModalDialog';
import { showConfirm } from '../../../components/common/ConfirmDialog';
import { Button } from '../../../components/ui';

const TYPE_OPTIONS = [
  { value: 'default', label: '默认' },
  { value: 'ongoing', label: '进行中' },
  { value: 'success', label: '成功' },
  { value: 'warning', label: '警告' },
  { value: 'error', label: '错误' },
];

const TYPE_COLORS = {
  default: 'bg-ui-bg-subtle text-ui-text-2 border-ui-border',
  ongoing: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  error: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
};

const SettingsAnnouncements = ({ options, refresh }) => {
  const { t } = useTranslation();
  const [list, setList] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [form, setForm] = useState({ content: '', publishDate: '', type: 'default', extra: '' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState([]);
  const [panelEnabled, setPanelEnabled] = useState(true);
  const [showContentFull, setShowContentFull] = useState(false);

  useEffect(() => {
    const str = options['console_setting.announcements'] ?? options.Announcements;
    if (str === undefined) return;
    try {
      const parsed = JSON.parse(str);
      const arr = Array.isArray(parsed) ? parsed : [];
      setList(arr.map((item, i) => ({ ...item, id: item.id || i + 1 })));
    } catch {
      setList([]);
    }
  }, [options['console_setting.announcements'], options.Announcements]);

  useEffect(() => {
    const v = options['console_setting.announcements_enabled'];
    setPanelEnabled(v === undefined ? true : v === 'true' || v === true);
  }, [options['console_setting.announcements_enabled']]);

  const handleToggleEnabled = async (checked) => {
    try {
      const res = await API.put('/api/option/', {
        key: 'console_setting.announcements_enabled',
        value: checked ? 'true' : 'false',
      });
      if (res.data.success) {
        setPanelEnabled(checked);
        showSuccess(t('设置已保存'));
        refresh?.();
      } else showError(res.data.message);
    } catch (err) { showError(err.message); }
  };

  const submitAll = async () => {
    setLoading(true);
    try {
      const res = await API.put('/api/option/', {
        key: 'console_setting.announcements',
        value: JSON.stringify(list),
      });
      if (res.data.success) {
        showSuccess(t('系统公告已更新'));
        setHasChanges(false);
        refresh?.();
      } else showError(res.data.message);
    } catch { showError(t('系统公告更新失败')); }
    finally { setLoading(false); }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ content: '', publishDate: new Date().toISOString().slice(0, 16), type: 'default', extra: '' });
    setShowModal(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    setForm({
      content: record.content || '',
      publishDate: record.publishDate ? new Date(record.publishDate).toISOString().slice(0, 16) : '',
      type: record.type || 'default',
      extra: record.extra || '',
    });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.content) return showError(t('请输入公告内容'));
    setModalLoading(true);
    const formData = { ...form, publishDate: new Date(form.publishDate).toISOString() };
    let newList;
    if (editing) {
      newList = list.map((item) => (item.id === editing.id ? { ...item, ...formData } : item));
    } else {
      const newId = Math.max(...list.map((item) => item.id), 0) + 1;
      newList = [...list, { id: newId, ...formData }];
    }
    setList(newList);
    setHasChanges(true);
    setShowModal(false);
    setModalLoading(false);
    showSuccess(editing ? t('公告已更新') : t('公告已添加'));
  };

  const handleDelete = (record) => {
    showConfirm({
      title: t('确认删除'),
      content: t('确定要删除此公告吗？'),
      danger: true,
      okText: t('确认删除'),
      onOk: () => {
        setList((prev) => prev.filter((item) => item.id !== record.id));
        setHasChanges(true);
        showSuccess(t('公告已删除'));
      },
    });
  };

  const handleBatchDelete = () => {
    if (!selected.length) return;
    showConfirm({
      title: t('批量删除'),
      content: `${t('确定要删除')} ${selected.length} ${t('个公告吗？')}`,
      danger: true,
      okText: t('确认删除'),
      onOk: () => {
        setList((prev) => prev.filter((item) => !selected.includes(item.id)));
        setSelected([]);
        setHasChanges(true);
        showSuccess(`${t('已删除')} ${selected.length} ${t('个公告')}`);
      },
    });
  };

  const sorted = [...list].sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  const columns = [
    {
      key: 'content', title: t('内容'), dataIndex: 'content',
      render: (text) => (
        <div className='max-w-[280px] truncate' title={text}>{text}</div>
      ),
    },
    {
      key: 'publishDate', title: t('发布时间'), dataIndex: 'publishDate', width: 170,
      render: (d) => d ? (
        <div>
          <div className='font-semibold'>{getRelativeTime(d)}</div>
          <div className='text-[11px] text-ui-text-3 mt-0.5'>{formatDateTimeString(new Date(d))}</div>
        </div>
      ) : '-',
    },
    {
      key: 'type', title: t('类型'), dataIndex: 'type', width: 90,
      render: (type) => (
        <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full border ${TYPE_COLORS[type] || TYPE_COLORS.default}`}>
          {TYPE_OPTIONS.find((o) => o.value === type)?.label || type}
        </span>
      ),
    },
    {
      key: 'extra', title: t('说明'), dataIndex: 'extra',
      render: (text) => <span className='text-ui-text-3 truncate max-w-[180px] inline-block'>{text || '-'}</span>,
    },
    {
      key: 'action', title: t('操作'), width: 130,
      render: (_, row) => (
        <div className='flex items-center gap-1'>
          <Button size='sm' variant='secondary' onClick={() => openEdit(row)}>
            {t('编辑')}
          </Button>
          <Button size='sm' variant='danger' onClick={() => handleDelete(row)}>
            {t('删除')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <CrudSection
        title={t('系统公告管理')}
        hint={t('可以发布系统通知和重要消息（最多 100 个，前端显示最新 20 条）')}columns={columns}
        dataSource={paged}
        loading={loading}
        page={page}
        pageSize={pageSize}
        total={sorted.length}
        onPageChange={setPage}
        selectedRowKeys={selected}
        onSelectionChange={setSelected}
        onAdd={openAdd}
        addLabel={t('添加公告')}
        onBatchDelete={handleBatchDelete}
        onSave={submitAll}
        saveDisabled={!hasChanges}
        saveLoading={loading}
        enabled={panelEnabled}
        onToggleEnabled={handleToggleEnabled}
        emptyLabel={t('暂无系统公告')}
      />

      <ModalDialog
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? t('编辑公告') : t('添加公告')}
        loading={modalLoading}
        width={600}
        footer={
          <div className='flex justify-end gap-2'>
            <Button variant='secondary' onClick={() => setShowModal(false)}>{t('取消')}</Button>
            <Button onClick={handleSave} disabled={modalLoading}>{t('保存')}</Button>
          </div>
        }
      >
        <label className='text-xs font-medium text-ui-text-2 block mb-1'>{t('公告内容')} *</label>
        <div className='relative'>
          <textarea
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            placeholder={t('请输入公告内容（支持 Markdown/HTML）')}
            rows={4}
            maxLength={500}
            className='w-full rounded-xl border border-ui-border bg-ui-bg-subtle text-ui-text text-xs px-3 py-2 pr-9 focus:outline-none focus:ring-1 focus:ring-ui-accent/40 resize-y'
          />
          <button
            type='button'
            onClick={() => setShowContentFull(true)}
            className='absolute right-2 top-2 text-ui-text-3 hover:text-ui-text'
            title={t('放大编辑')}
          >
            </button>
        </div>
        <div className='grid grid-cols-2 gap-3'>
          <div>
            <label className='text-xs font-medium text-ui-text-2 block mb-1'>{t('发布日期')} *</label>
            <input
              type='datetime-local'
              value={form.publishDate}
              onChange={(e) => setForm({ ...form, publishDate: e.target.value })}
              className='w-full rounded-xl border border-ui-border bg-ui-bg-subtle text-ui-text text-xs px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ui-accent/40'
            />
          </div>
          <div>
            <label className='text-xs font-medium text-ui-text-2 block mb-1'>{t('公告类型')}</label>
            <NativeSelect
              value={form.type}
              onChange={(v) => setForm({ ...form, type: v })}
              options={TYPE_OPTIONS}
            />
          </div>
        </div>
        <div>
          <label className='text-xs font-medium text-ui-text-2 block mb-1'>{t('说明信息')}</label>
          <input
            type='text'
            value={form.extra}
            onChange={(e) => setForm({ ...form, extra: e.target.value })}
            placeholder={t('可选，公告的补充说明')}
            className='w-full rounded-xl border border-ui-border bg-ui-bg-subtle text-ui-text text-xs px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ui-accent/40'
          />
        </div>
      </ModalDialog>

      {/* Fullscreen content editor */}
      <ModalDialog
        open={showContentFull}
        onClose={() => setShowContentFull(false)}
        title={t('编辑公告内容')}
        width={800}
        footer={
          <div className='flex justify-end gap-2'>
            <Button variant='secondary' onClick={() => setShowContentFull(false)}>{t('确定')}</Button>
          </div>
        }
      >
        <textarea
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          placeholder={t('请输入公告内容（支持 Markdown/HTML）')}
          maxLength={500}
          rows={15}
          className='w-full rounded-xl border border-ui-border bg-ui-bg-subtle text-ui-text text-xs px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ui-accent/40 resize-y font-mono'
        />
      </ModalDialog>
    </>
  );
};

export default SettingsAnnouncements;

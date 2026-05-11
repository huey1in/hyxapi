/*
 * 常见问答管理 — token-system rewrite.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../../helpers';
import CrudSection from '../../../components/common/table/CrudSection';
import ModalDialog from '../../../components/common/ModalDialog';
import { showConfirm } from '../../../components/common/ConfirmDialog';
import { Button } from '../../../components/ui';

const SettingsFAQ = ({ options, refresh }) => {
  const { t } = useTranslation();
  const [list, setList] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [form, setForm] = useState({ question: '', answer: '' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState([]);
  const [panelEnabled, setPanelEnabled] = useState(true);

  useEffect(() => {
    const str = options['console_setting.faq'];
    if (str !== undefined) {
      try {
        const parsed = JSON.parse(str);
        const arr = Array.isArray(parsed) ? parsed : [];
        setList(arr.map((item, i) => ({ ...item, id: item.id || i + 1 })));
      } catch { setList([]); }
    }
  }, [options['console_setting.faq']]);

  useEffect(() => {
    const v = options['console_setting.faq_enabled'];
    setPanelEnabled(v === undefined ? true : v === 'true' || v === true);
  }, [options['console_setting.faq_enabled']]);

  const handleToggleEnabled = async (checked) => {
    try {
      const res = await API.put('/api/option/', {
        key: 'console_setting.faq_enabled',
        value: checked ? 'true' : 'false',
      });
      if (res.data.success) { setPanelEnabled(checked); showSuccess(t('设置已保存')); refresh?.(); }
      else showError(res.data.message);
    } catch (err) { showError(err.message); }
  };

  const submitAll = async () => {
    setLoading(true);
    try {
      const res = await API.put('/api/option/', { key: 'console_setting.faq', value: JSON.stringify(list) });
      if (res.data.success) { showSuccess(t('常见问答已更新')); setHasChanges(false); refresh?.(); }
      else showError(res.data.message);
    } catch { showError(t('常见问答更新失败')); }
    finally { setLoading(false); }
  };

  const openAdd = () => { setEditing(null); setForm({ question: '', answer: '' }); setShowModal(true); };
  const openEdit = (record) => { setEditing(record); setForm({ question: record.question, answer: record.answer }); setShowModal(true); };

  const handleSave = () => {
    if (!form.question || !form.answer) return showError(t('请填写完整的问答信息'));
    setModalLoading(true);
    let newList;
    if (editing) {
      newList = list.map((item) => (item.id === editing.id ? { ...item, ...form } : item));
    } else {
      const newId = Math.max(...list.map((item) => item.id), 0) + 1;
      newList = [...list, { id: newId, ...form }];
    }
    setList(newList); setHasChanges(true); setShowModal(false); setModalLoading(false);
    showSuccess(editing ? t('问答已更新') : t('问答已添加'));
  };

  const handleDelete = (record) => {
    showConfirm({
      title: t('确认删除'), content: t('确定要删除此问答吗？'), danger: true, okText: t('确认删除'),
      onOk: () => { setList((prev) => prev.filter((item) => item.id !== record.id)); setHasChanges(true); showSuccess(t('问答已删除')); },
    });
  };

  const handleBatchDelete = () => {
    if (!selected.length) return;
    showConfirm({
      title: t('批量删除'), content: `${t('确定要删除')} ${selected.length} ${t('个问答吗？')}`, danger: true, okText: t('确认删除'),
      onOk: () => { setList((prev) => prev.filter((item) => !selected.includes(item.id))); setSelected([]); setHasChanges(true); showSuccess(`${t('已删除')} ${selected.length} ${t('个问答')}`); },
    });
  };

  const paged = list.slice((page - 1) * pageSize, page * pageSize);

  const columns = [
    {
      key: 'question', title: t('问题标题'), dataIndex: 'question',
      render: (text) => <div className='max-w-[280px] truncate font-semibold'>{text}</div>,
    },
    {
      key: 'answer', title: t('回答内容'), dataIndex: 'answer',
      render: (text) => <div className='max-w-[360px] truncate text-ui-text-2'>{text}</div>,
    },
    {
      key: 'action', title: t('操作'), width: 130,
      render: (_, row) => (
        <div className='flex items-center gap-1'>
          <Button size='sm' variant='secondary' onClick={() => openEdit(row)}>{t('编辑')}</Button>
          <Button size='sm' variant='danger' onClick={() => handleDelete(row)}>{t('删除')}</Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <CrudSection
        title={t('常见问答管理')}
        hint={t('为用户提供常见问题的答案（最多 50 个，前端显示最新 20 条）')}columns={columns}
        dataSource={paged}
        loading={loading}
        page={page}
        pageSize={pageSize}
        total={list.length}
        onPageChange={setPage}
        selectedRowKeys={selected}
        onSelectionChange={setSelected}
        onAdd={openAdd}
        addLabel={t('添加问答')}
        onBatchDelete={handleBatchDelete}
        onSave={submitAll}
        saveDisabled={!hasChanges}
        saveLoading={loading}
        enabled={panelEnabled}
        onToggleEnabled={handleToggleEnabled}
        emptyLabel={t('暂无常见问答')}
      />

      <ModalDialog
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? t('编辑问答') : t('添加问答')}
        loading={modalLoading}
        width={600}
        footer={
          <div className='flex justify-end gap-2'>
            <Button variant='secondary' onClick={() => setShowModal(false)}>{t('取消')}</Button>
            <Button onClick={handleSave} disabled={modalLoading}>{t('保存')}</Button>
          </div>
        }
      >
        <div>
          <label className='text-xs font-medium text-ui-text-2 block mb-1'>{t('问题标题')} *</label>
          <input
            type='text' value={form.question}
            onChange={(e) => setForm({ ...form, question: e.target.value })}
            placeholder={t('请输入问题标题')}
            maxLength={200}
            className='w-full rounded-xl border border-ui-border bg-ui-bg-subtle text-ui-text text-xs px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ui-accent/40'
          />
        </div>
        <div>
          <label className='text-xs font-medium text-ui-text-2 block mb-1'>{t('回答内容')} *</label>
          <textarea
            value={form.answer}
            onChange={(e) => setForm({ ...form, answer: e.target.value })}
            placeholder={t('请输入回答内容（支持 Markdown/HTML）')}
            rows={6}
            maxLength={1000}
            className='w-full rounded-xl border border-ui-border bg-ui-bg-subtle text-ui-text text-xs px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ui-accent/40 resize-y'
          />
        </div>
      </ModalDialog>
    </>
  );
};

export default SettingsFAQ;

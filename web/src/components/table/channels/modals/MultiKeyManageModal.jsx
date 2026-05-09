/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import ModalDialog from '../../../common/ModalDialog';
import { showConfirm } from '../../../common/ConfirmDialog';
import Select from '../../../common/form/Select';
import {
  API,
  showError,
  showSuccess,
  timestamp2string,
} from '../../../../helpers';

const TAG_COLOR_CLASSES = {
  green:
    'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  red: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  orange:
    'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  grey: 'bg-ui-bg-subtle text-ui-text-2 border-ui-border',
  white: 'bg-ui-bg-elevated text-ui-text-2 border-ui-border',
};

const Tag = ({ color = 'grey', children, className = '' }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 text-[11px] rounded-xl font-medium border ${
      TAG_COLOR_CLASSES[color] || TAG_COLOR_CLASSES.grey
    } ${className}`}
  >
    {children}
  </span>
);

const MultiKeyManageModal = ({ visible, onCancel, channel, onRefresh }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [keyStatusList, setKeyStatusList] = useState([]);
  const [operationLoading, setOperationLoading] = useState({});

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Statistics states
  const [enabledCount, setEnabledCount] = useState(0);
  const [manualDisabledCount, setManualDisabledCount] = useState(0);
  const [autoDisabledCount, setAutoDisabledCount] = useState(0);

  // Filter states
  const [statusFilter, setStatusFilter] = useState(null); // null=all, 1=enabled, 2=manual_disabled, 3=auto_disabled

  // Load key status data
  const loadKeyStatus = async (
    page = currentPage,
    size = pageSize,
    status = statusFilter,
  ) => {
    if (!channel?.id) return;

    setLoading(true);
    try {
      const requestData = {
        channel_id: channel.id,
        action: 'get_key_status',
        page: page,
        page_size: size,
      };

      // Add status filter if specified
      if (status !== null) {
        requestData.status = status;
      }

      const res = await API.post('/api/channel/multi_key/manage', requestData);

      if (res.data.success) {
        const data = res.data.data;
        setKeyStatusList(data.keys || []);
        setTotal(data.total || 0);
        setCurrentPage(data.page || 1);
        setPageSize(data.page_size || 10);
        setTotalPages(data.total_pages || 0);

        // Update statistics (these are always the overall statistics)
        setEnabledCount(data.enabled_count || 0);
        setManualDisabledCount(data.manual_disabled_count || 0);
        setAutoDisabledCount(data.auto_disabled_count || 0);
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      console.error(error);
      showError(t('获取密钥状态失败'));
    } finally {
      setLoading(false);
    }
  };

  // Disable a specific key
  const handleDisableKey = async (keyIndex) => {
    const operationId = `disable_${keyIndex}`;
    setOperationLoading((prev) => ({ ...prev, [operationId]: true }));

    try {
      const res = await API.post('/api/channel/multi_key/manage', {
        channel_id: channel.id,
        action: 'disable_key',
        key_index: keyIndex,
      });

      if (res.data.success) {
        showSuccess(t('密钥已禁用'));
        await loadKeyStatus(currentPage, pageSize); // Reload current page
        onRefresh && onRefresh(); // Refresh parent component
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('禁用密钥失败'));
    } finally {
      setOperationLoading((prev) => ({ ...prev, [operationId]: false }));
    }
  };

  // Enable a specific key
  const handleEnableKey = async (keyIndex) => {
    const operationId = `enable_${keyIndex}`;
    setOperationLoading((prev) => ({ ...prev, [operationId]: true }));

    try {
      const res = await API.post('/api/channel/multi_key/manage', {
        channel_id: channel.id,
        action: 'enable_key',
        key_index: keyIndex,
      });

      if (res.data.success) {
        showSuccess(t('密钥已启用'));
        await loadKeyStatus(currentPage, pageSize); // Reload current page
        onRefresh && onRefresh(); // Refresh parent component
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('启用密钥失败'));
    } finally {
      setOperationLoading((prev) => ({ ...prev, [operationId]: false }));
    }
  };

  // Enable all disabled keys
  const handleEnableAll = async () => {
    setOperationLoading((prev) => ({ ...prev, enable_all: true }));

    try {
      const res = await API.post('/api/channel/multi_key/manage', {
        channel_id: channel.id,
        action: 'enable_all_keys',
      });

      if (res.data.success) {
        showSuccess(res.data.message || t('已启用所有密钥'));
        // Reset to first page after bulk operation
        setCurrentPage(1);
        await loadKeyStatus(1, pageSize);
        onRefresh && onRefresh(); // Refresh parent component
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('启用所有密钥失败'));
    } finally {
      setOperationLoading((prev) => ({ ...prev, enable_all: false }));
    }
  };

  // Disable all enabled keys
  const handleDisableAll = async () => {
    setOperationLoading((prev) => ({ ...prev, disable_all: true }));

    try {
      const res = await API.post('/api/channel/multi_key/manage', {
        channel_id: channel.id,
        action: 'disable_all_keys',
      });

      if (res.data.success) {
        showSuccess(res.data.message || t('已禁用所有密钥'));
        // Reset to first page after bulk operation
        setCurrentPage(1);
        await loadKeyStatus(1, pageSize);
        onRefresh && onRefresh(); // Refresh parent component
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('禁用所有密钥失败'));
    } finally {
      setOperationLoading((prev) => ({ ...prev, disable_all: false }));
    }
  };

  // Delete all disabled keys
  const handleDeleteDisabledKeys = async () => {
    setOperationLoading((prev) => ({ ...prev, delete_disabled: true }));

    try {
      const res = await API.post('/api/channel/multi_key/manage', {
        channel_id: channel.id,
        action: 'delete_disabled_keys',
      });

      if (res.data.success) {
        showSuccess(res.data.message);
        // Reset to first page after deletion as data structure might change
        setCurrentPage(1);
        await loadKeyStatus(1, pageSize);
        onRefresh && onRefresh(); // Refresh parent component
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('删除禁用密钥失败'));
    } finally {
      setOperationLoading((prev) => ({ ...prev, delete_disabled: false }));
    }
  };

  // Delete a specific key
  const handleDeleteKey = async (keyIndex) => {
    const operationId = `delete_${keyIndex}`;
    setOperationLoading((prev) => ({ ...prev, [operationId]: true }));

    try {
      const res = await API.post('/api/channel/multi_key/manage', {
        channel_id: channel.id,
        action: 'delete_key',
        key_index: keyIndex,
      });

      if (res.data.success) {
        showSuccess(t('密钥已删除'));
        await loadKeyStatus(currentPage, pageSize); // Reload current page
        onRefresh && onRefresh(); // Refresh parent component
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('删除密钥失败'));
    } finally {
      setOperationLoading((prev) => ({ ...prev, [operationId]: false }));
    }
  };

  // Handle page change
  const handlePageChange = (page) => {
    setCurrentPage(page);
    loadKeyStatus(page, pageSize);
  };

  // Handle page size change
  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page
    loadKeyStatus(1, size);
  };

  // Handle status filter change
  const handleStatusFilterChange = (status) => {
    setStatusFilter(status);
    setCurrentPage(1); // Reset to first page when filter changes
    loadKeyStatus(1, pageSize, status);
  };

  // Effect to load data when modal opens
  useEffect(() => {
    if (visible && channel?.id) {
      setCurrentPage(1); // Reset to first page when opening
      loadKeyStatus(1, pageSize);
    }
  }, [visible, channel?.id]);

  // Reset pagination when modal closes
  useEffect(() => {
    if (!visible) {
      setCurrentPage(1);
      setKeyStatusList([]);
      setTotal(0);
      setTotalPages(0);
      setEnabledCount(0);
      setManualDisabledCount(0);
      setAutoDisabledCount(0);
      setStatusFilter(null); // Reset filter
    }
  }, [visible]);

  // Percentages for progress display
  const enabledPercent =
    total > 0 ? Math.round((enabledCount / total) * 100) : 0;
  const manualDisabledPercent =
    total > 0 ? Math.round((manualDisabledCount / total) * 100) : 0;
  const autoDisabledPercent =
    total > 0 ? Math.round((autoDisabledCount / total) * 100) : 0;

  // Get status tag component
  const renderStatusTag = (status) => {
    switch (status) {
      case 1:
        return <Tag color='green'>{t('已启用')}</Tag>;
      case 2:
        return <Tag color='red'>{t('已禁用')}</Tag>;
      case 3:
        return <Tag color='orange'>{t('自动禁用')}</Tag>;
      default:
        return <Tag color='grey'>{t('未知状态')}</Tag>;
    }
  };

  const StatCard = ({ label, count, total, color, percent }) => (
    <div className='flex-1 bg-ui-bg-elevated border border-ui-border rounded-xl p-3'>
      <div className='flex items-center gap-2 mb-2'>
        <span
          className='inline-block w-2 h-2 rounded-full'
          style={{ background: color }}
        />
        <span className='text-xs text-ui-text-3'>{label}</span>
      </div>
      <div className='flex items-end gap-2 mb-2'>
        <span
          className='text-lg font-bold tabular-nums'
          style={{ color }}
        >
          {count}
        </span>
        <span className='text-sm text-ui-text-3'>/ {total}</span>
      </div>
      <div className='h-1.5 rounded-full bg-ui-bg-subtle overflow-hidden'>
        <div
          className='h-full rounded-full transition-all'
          style={{ width: `${percent}%`, background: color }}
        />
      </div>
    </div>
  );

  const headerExtra = (
    <div className='flex items-center gap-2 flex-wrap'>
      <span className='text-base font-semibold text-ui-text'>
        {t('多密钥管理')}
      </span>
      {channel?.name && <Tag color='white'>{channel.name}</Tag>}
      <Tag color='white'>
        {t('总密钥数')}: {total}
      </Tag>
      {channel?.channel_info?.multi_key_mode && (
        <Tag color='white'>
          {channel.channel_info.multi_key_mode === 'random'
            ? t('随机模式')
            : t('轮询模式')}
        </Tag>
      )}
    </div>
  );

  const totalPagesComputed =
    totalPages || Math.max(1, Math.ceil(total / pageSize));

  return (
    <ModalDialog
      open={visible}
      onClose={onCancel}
      title={headerExtra}
      width={900}
      hideFooter
    >
      <div className='flex flex-col'>
        {/* Stats */}
        <div className='flex flex-col md:flex-row gap-3 mb-3'>
          <StatCard
            label={t('已启用')}
            count={enabledCount}
            total={total}
            color='#22c55e'
            percent={enabledPercent}
          />
          <StatCard
            label={t('手动禁用')}
            count={manualDisabledCount}
            total={total}
            color='#ef4444'
            percent={manualDisabledPercent}
          />
          <StatCard
            label={t('自动禁用')}
            count={autoDisabledCount}
            total={total}
            color='#f59e0b'
            percent={autoDisabledPercent}
          />
        </div>

        {/* Toolbar */}
        <div className='flex flex-wrap items-center gap-2 justify-between mb-3'>
          <div className='min-w-[160px]'>
            <Select
              value={statusFilter == null ? '__all__' : String(statusFilter)}
              onChange={(v) =>
                handleStatusFilterChange(v === '__all__' ? null : Number(v))
              }
              options={[
                { value: '__all__', label: t('全部状态') },
                { value: '1', label: t('已启用') },
                { value: '2', label: t('手动禁用') },
                { value: '3', label: t('自动禁用') },
              ]}
              placeholder={t('全部状态')}
            />
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <button
              onClick={() => loadKeyStatus(currentPage, pageSize)}
              disabled={loading}
              className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors disabled:opacity-60'
            >
              {loading && <Loader2 size={12} className='animate-spin' />}
              {t('刷新')}
            </button>
            {manualDisabledCount + autoDisabledCount > 0 && (
              <button
                onClick={() =>
                  showConfirm({
                    title: t('确定要启用所有密钥吗？'),
                    onOk: handleEnableAll,
                  })
                }
                disabled={operationLoading.enable_all}
                className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover transition-colors disabled:opacity-60'
              >
                {operationLoading.enable_all && (
                  <Loader2 size={12} className='animate-spin' />
                )}
                {t('启用全部')}
              </button>
            )}
            {enabledCount > 0 && (
              <button
                onClick={() =>
                  showConfirm({
                    title: t('确定要禁用所有的密钥吗？'),
                    danger: true,
                    onOk: handleDisableAll,
                  })
                }
                disabled={operationLoading.disable_all}
                className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-ui-danger text-white hover:opacity-90 transition-opacity disabled:opacity-60'
              >
                {operationLoading.disable_all && (
                  <Loader2 size={12} className='animate-spin' />
                )}
                {t('禁用全部')}
              </button>
            )}
            <button
              onClick={() =>
                showConfirm({
                  title: t('确定要删除所有已自动禁用的密钥吗？'),
                  content: t('此操作不可撤销，将永久删除已自动禁用的密钥'),
                  danger: true,
                  onOk: handleDeleteDisabledKeys,
                })
              }
              disabled={operationLoading.delete_disabled}
              className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:opacity-90 transition-opacity disabled:opacity-60'
            >
              {operationLoading.delete_disabled && (
                <Loader2 size={12} className='animate-spin' />
              )}
              {t('删除自动禁用密钥')}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className='border border-ui-border rounded-xl overflow-hidden bg-ui-bg-elevated'>
          {loading ? (
            <div className='flex items-center justify-center py-10 gap-2 text-ui-text-2'>
              <Loader2 size={18} className='animate-spin' />
              <span>{t('加载中...')}</span>
            </div>
          ) : keyStatusList.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-10 text-ui-text-3'>
              <Search size={32} className='mb-2 opacity-50' />
              <span className='text-sm font-medium text-ui-text-2'>
                {t('暂无密钥数据')}
              </span>
              <span className='text-xs mt-1'>
                {t('请检查渠道配置或刷新重试')}
              </span>
            </div>
          ) : (
            <div className='overflow-x-auto nice-scroll'>
              <table className='w-full'>
                <thead>
                  <tr className='bg-ui-bg-subtle/50 text-[11px] uppercase tracking-wider text-ui-text-3'>
                    <th className='px-3 py-2 text-left font-medium'>
                      {t('索引')}
                    </th>
                    <th className='px-3 py-2 text-left font-medium'>
                      {t('状态')}
                    </th>
                    <th className='px-3 py-2 text-left font-medium'>
                      {t('禁用原因')}
                    </th>
                    <th className='px-3 py-2 text-left font-medium'>
                      {t('禁用时间')}
                    </th>
                    <th className='px-3 py-2 text-right font-medium'>
                      {t('操作')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {keyStatusList.map((record) => (
                    <tr
                      key={record.index}
                      className='border-t border-ui-divider hover:bg-ui-bg-subtle/40'
                    >
                      <td className='px-3 py-3 text-sm text-ui-text tabular-nums'>
                        #{Number(record.index) + 1}
                      </td>
                      <td className='px-3 py-3'>
                        {renderStatusTag(record.status)}
                      </td>
                      <td className='px-3 py-3 text-sm text-ui-text-2'>
                        {record.status === 1 || !record.reason ? (
                          <span className='text-ui-text-3'>-</span>
                        ) : (
                          <span
                            title={record.reason}
                            className='block max-w-[200px] truncate'
                          >
                            {record.reason}
                          </span>
                        )}
                      </td>
                      <td className='px-3 py-3 text-xs text-ui-text-2'>
                        {record.status === 1 || !record.disabled_time ? (
                          <span className='text-ui-text-3'>-</span>
                        ) : (
                          <span title={timestamp2string(record.disabled_time)}>
                            {timestamp2string(record.disabled_time)}
                          </span>
                        )}
                      </td>
                      <td className='px-3 py-3'>
                        <div className='flex items-center gap-2 justify-end'>
                          {record.status === 1 ? (
                            <button
                              disabled={
                                operationLoading[`disable_${record.index}`]
                              }
                              onClick={() => handleDisableKey(record.index)}
                              className='inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-ui-danger text-white hover:opacity-90 transition-opacity disabled:opacity-60'
                            >
                              {operationLoading[`disable_${record.index}`] && (
                                <Loader2
                                  size={11}
                                  className='animate-spin'
                                />
                              )}
                              {t('禁用')}
                            </button>
                          ) : (
                            <button
                              disabled={
                                operationLoading[`enable_${record.index}`]
                              }
                              onClick={() => handleEnableKey(record.index)}
                              className='inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover transition-colors disabled:opacity-60'
                            >
                              {operationLoading[`enable_${record.index}`] && (
                                <Loader2
                                  size={11}
                                  className='animate-spin'
                                />
                              )}
                              {t('启用')}
                            </button>
                          )}
                          <button
                            disabled={operationLoading[`delete_${record.index}`]}
                            onClick={() =>
                              showConfirm({
                                title: t('确定要删除此密钥吗？'),
                                content: t(
                                  '此操作不可撤销，将永久删除该密钥',
                                ),
                                danger: true,
                                onOk: () => handleDeleteKey(record.index),
                              })
                            }
                            className='inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-ui-danger text-white hover:opacity-90 transition-opacity disabled:opacity-60'
                          >
                            {operationLoading[`delete_${record.index}`] && (
                              <Loader2 size={11} className='animate-spin' />
                            )}
                            {t('删除')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {keyStatusList.length > 0 && (
          <div className='flex flex-wrap items-center justify-between gap-2 mt-3 text-xs text-ui-text-2'>
            <div className='flex items-center gap-2'>
              <span>
                {t('共')} {total}
              </span>
              <div className='w-[110px]'>
                <Select
                  value={String(pageSize)}
                  onChange={(v) => handlePageSizeChange(Number(v))}
                  options={[
                    { value: '10', label: '10 / page' },
                    { value: '20', label: '20 / page' },
                    { value: '50', label: '50 / page' },
                    { value: '100', label: '100 / page' },
                  ]}
                />
              </div>
            </div>
            <div className='flex items-center gap-1'>
              <button
                disabled={currentPage <= 1}
                onClick={() => handlePageChange(currentPage - 1)}
                className='inline-flex items-center justify-center w-8 h-8 rounded-lg border border-ui-border text-ui-text-2 hover:bg-ui-bg-subtle disabled:opacity-40 disabled:cursor-not-allowed'
              >
                <ChevronLeft size={14} />
              </button>
              <span className='px-2 tabular-nums'>
                {currentPage} / {totalPagesComputed}
              </span>
              <button
                disabled={currentPage >= totalPagesComputed}
                onClick={() => handlePageChange(currentPage + 1)}
                className='inline-flex items-center justify-center w-8 h-8 rounded-lg border border-ui-border text-ui-text-2 hover:bg-ui-bg-subtle disabled:opacity-40 disabled:cursor-not-allowed'
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalDialog>
  );
};

export default MultiKeyManageModal;

/*
 * 渠道选择弹窗 — token-system rewrite.
 */
import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import ModalDialog from '../common/ModalDialog';
import Pagination from '../common/table/Pagination';

const OFFICIAL_RATIO_PRESET_ID = -100;
const MODELS_DEV_PRESET_ID = -101;
const OFFICIAL_RATIO_PRESET_BASE_URL = 'https://basellm.github.io';
const MODELS_DEV_PRESET_BASE_URL = 'https://models.dev';
const OFFICIAL_RATIO_PRESET_NAME = '官方倍率预设';
const MODELS_DEV_PRESET_NAME = 'models.dev 价格预设';

const ENDPOINT_OPTIONS = [
  { value: 'ratio_config', label: 'ratio_config' },
  { value: 'pricing', label: 'pricing' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'custom', label: 'custom' },
];

const getEndpointType = (ep) => {
  if (ep === '/api/ratio_config') return 'ratio_config';
  if (ep === '/api/pricing') return 'pricing';
  if (ep === 'openrouter') return 'openrouter';
  return 'custom';
};

const isOfficialChannel = (record) => {
  const id = record?.key ?? record?.value ?? record?._originalData?.id;
  const base = record?._originalData?.base_url || '';
  const name = record?.label || '';
  return (
    id === OFFICIAL_RATIO_PRESET_ID || id === MODELS_DEV_PRESET_ID ||
    base === OFFICIAL_RATIO_PRESET_BASE_URL || base === MODELS_DEV_PRESET_BASE_URL ||
    name === OFFICIAL_RATIO_PRESET_NAME || name === MODELS_DEV_PRESET_NAME
  );
};

const STATUS_MAP = {
  1: { label: '已启用', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  2: { label: '已禁用', color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
  3: { label: '自动禁用', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
};
const DEFAULT_STATUS = { label: '未知状态', color: 'bg-ui-bg-subtle0/10 text-ui-text-2 border-gray-400/20' };

function highlightMatch(text, keyword) {
  if (!keyword || !text) return text;
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className='bg-amber-200 dark:bg-amber-800 text-inherit rounded-sm px-0.5'>{text.slice(idx, idx + keyword.length)}</mark>
      {text.slice(idx + keyword.length)}
    </>
  );
}

const selectCls = 'rounded border border-ui-border bg-ui-bg-subtle text-ui-text text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ui-accent/40';
const miniTag = 'inline-block text-[10px] px-1.5 py-0.5 rounded-full border font-medium';

const ChannelSelectorModal = forwardRef(
  ({ visible, onCancel, onOk, allChannels, selectedChannelIds, setSelectedChannelIds, channelEndpoints, updateChannelEndpoint, t }, ref) => {
    const [searchText, setSearchText] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    useImperativeHandle(ref, () => ({ resetPagination: () => { setCurrentPage(1); setSearchText(''); } }));

    const filtered = (() => {
      const searchLower = searchText.trim().toLowerCase();
      const matched = searchLower
        ? allChannels.filter((item) =>
            (item.label || '').toLowerCase().includes(searchLower) ||
            (item._originalData?.base_url || '').toLowerCase().includes(searchLower)
          )
        : allChannels;
      return [...matched].sort((a, b) => (isOfficialChannel(a) ? 0 : 1) - (isOfficialChannel(b) ? 0 : 1));
    })();

    const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const updateEndpoint = (channelId, endpoint) => {
      if (typeof updateChannelEndpoint === 'function') updateChannelEndpoint(channelId, endpoint);
    };

    const allSelected = paged.length > 0 && paged.every((ch) => selectedChannelIds.includes(ch.key));
    const toggleAll = () => {
      if (allSelected) setSelectedChannelIds([]);
      else setSelectedChannelIds([...new Set([...selectedChannelIds, ...paged.map((ch) => ch.key)])]);
    };
    const toggleRow = (key) => {
      setSelectedChannelIds(
        selectedChannelIds.includes(key)
          ? selectedChannelIds.filter((k) => k !== key)
          : [...selectedChannelIds, key]
      );
    };

    return (
      <ModalDialog
        open={visible}
        onClose={onCancel}
        title={t('选择同步渠道')}
        width={900}
        footer={
          <div className='flex justify-end gap-2'>
            <button onClick={onCancel} className='px-3.5 py-1.5 text-xs rounded-xl border border-ui-border text-ui-text-2 hover:bg-ui-bg-subtle'>{t('取消')}</button>
            <button onClick={onOk} className='px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-ui-accent text-ui-accent-fg hover:opacity-90'>{t('确定')}</button>
          </div>
        }
      >
        <div className='space-y-3'>
          <div className='relative'>
            <input
              type='text' value={searchText} onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }}
              placeholder={t('搜索渠道名称或地址')}
              className='w-full rounded-md border border-ui-border bg-ui-bg-subtle text-ui-text text-xs pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ui-accent/40'
            />
          </div>

          <div className='rounded-md border border-ui-border overflow-hidden'>
            <div className='overflow-x-auto nice-scroll'>
              <table className='w-full text-xs'>
                <thead>
                  <tr className='bg-ui-bg-subtle'>
                    <th className='w-9 px-3 py-2 text-left'>
                      <input type='checkbox' checked={allSelected} onChange={toggleAll}
                        className='rounded border-ui-border text-ui-accent focus:ring-ui-accent/40' />
                    </th>
                    <th className='px-3 py-2 text-left font-semibold text-ui-text-2'>{t('名称')}</th>
                    <th className='px-3 py-2 text-left font-semibold text-ui-text-2'>{t('源地址')}</th>
                    <th className='px-3 py-2 text-left font-semibold text-ui-text-2 w-[100px]'>{t('状态')}</th>
                    <th className='px-3 py-2 text-left font-semibold text-ui-text-2 w-[280px]'>{t('同步接口')}</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-ui-divider'>
                  {paged.length === 0 ? (
                    <tr><td colSpan={5} className='px-3 py-6 text-center text-ui-text-3'>{t('暂无渠道')}</td></tr>
                  ) : paged.map((ch) => {
                    const id = ch.key;
                    const status = ch._originalData?.status || 0;
                    const statusInfo = STATUS_MAP[status] || DEFAULT_STATUS;
                    const official = isOfficialChannel(ch);
                    const endpoint = channelEndpoints[id] || '';
                    const endpointType = getEndpointType(endpoint);

                    return (
                      <tr key={id} className='hover:bg-ui-bg-hover/50'>
                        <td className='px-3 py-2'>
                          <input type='checkbox' checked={selectedChannelIds.includes(id)} onChange={() => toggleRow(id)}
                            className='rounded border-ui-border text-ui-accent focus:ring-ui-accent/40' />
                        </td>
                        <td className='px-3 py-2 font-medium text-ui-text'>
                          {highlightMatch(ch.label, searchText)}
                          {official && <span className={`${miniTag} ml-1.5 !bg-emerald-500/10 !text-emerald-600 dark:!text-emerald-400 !border-emerald-500/20`}>{t('官方')}</span>}
                        </td>
                        <td className='px-3 py-2 text-ui-text-2 font-mono text-[11px]'>
                          {highlightMatch(ch._originalData?.base_url || '', searchText)}
                        </td>
                        <td className='px-3 py-2'>
                          <span className={`${miniTag} ${statusInfo.color}`}>{t(statusInfo.label)}</span>
                        </td>
                        <td className='px-3 py-2'>
                          <div className='flex items-center gap-1.5'>
                            <select value={endpointType} onChange={(e) => {
                              const v = e.target.value;
                              if (v === 'ratio_config') updateEndpoint(id, '/api/ratio_config');
                              else if (v === 'pricing') updateEndpoint(id, '/api/pricing');
                              else if (v === 'openrouter') updateEndpoint(id, 'openrouter');
                              else if (endpointType !== 'custom') updateEndpoint(id, '');
                            }} className={`${selectCls} w-28`}>
                              {ENDPOINT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            {endpointType === 'custom' && (
                              <input type='text' value={endpoint} onChange={(e) => updateEndpoint(id, e.target.value)}
                                placeholder='/your/endpoint'
                                className='flex-1 rounded border border-ui-border bg-ui-bg-subtle text-ui-text text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ui-accent/40' />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length > pageSize && (
              <Pagination page={currentPage} pageSize={pageSize} total={filtered.length} onChange={setCurrentPage} />
            )}
          </div>
        </div>
      </ModalDialog>
    );
  },
);

export default ChannelSelectorModal;

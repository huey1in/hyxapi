/*
 * Channels table — custom token-system table.
 *
 * Drops Semi UI entirely (Table, Tag, Button, Dropdown, InputNumber).
 * Cells are kept lean: status pill, group chips, channel-icon + label,
 * inline number inputs for priority/weight, and three primary row actions
 * with a small overflow menu. Advanced features (multi-key indicators,
 * upstream-update tags, Codex balance) are hidden by default to keep the
 * table readable; access them through the row's edit/manage modal instead.
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown, MoreHorizontal, Power, AlertTriangle, RefreshCw, FlaskConical, Edit2,
} from 'lucide-react';
import { renderQuota, renderQuotaWithAmount, getChannelIcon } from '../../../helpers';
import { CHANNEL_OPTIONS } from '../../../constants';
import { showConfirm } from '../../common/ConfirmDialog';

// ── small helpers ───────────────────────────────────────

const typeLabelMap = (() => {
  const m = new Map();
  CHANNEL_OPTIONS.forEach((o) => m.set(o.value, o));
  return m;
})();

const groupColorPool = [
  'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
  'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
];
const groupColor = (str) => {
  if (!str) return groupColorPool[0];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return groupColorPool[Math.abs(h) % groupColorPool.length];
};

const isPassThrough = (record) => {
  if (!record || record.children !== undefined) return false;
  const v = record.setting;
  if (!v) return false;
  if (typeof v === 'object') return v.pass_through_body_enabled === true;
  try {
    return JSON.parse(v)?.pass_through_body_enabled === true;
  } catch {
    return false;
  }
};

const StatusPill = ({ status, channelInfo }) => {
  const cfg =
    status === 1
      ? { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', label: '已启用' }
      : status === 2
        ? { dot: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400', label: '已禁用' }
        : status === 3
          ? { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', label: '自动禁用' }
          : { dot: 'bg-ui-text-3', text: 'text-ui-text-3', label: '未知' };
  let suffix = '';
  if (channelInfo?.is_multi_key) {
    const total = channelInfo.multi_key_size || 0;
    const failed = channelInfo.multi_key_status_list
      ? Object.keys(channelInfo.multi_key_status_list).length
      : 0;
    suffix = ` ${total - failed}/${total}`;
  }
  return (
    <span className={`inline-flex items-center gap-1.5 ${cfg.text} text-xs font-medium`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
      {suffix}
    </span>
  );
};

const ResponsePill = ({ ms }) => {
  if (!ms) return <span className='text-ui-text-3 text-xs'>—</span>;
  const sec = (ms / 1000).toFixed(2);
  const cls =
    ms <= 1000
      ? 'text-emerald-600 dark:text-emerald-400'
      : ms <= 3000
        ? 'text-lime-600 dark:text-lime-400'
        : ms <= 5000
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-rose-600 dark:text-rose-400';
  return <span className={`text-xs font-medium tabular-nums ${cls}`}>{sec}s</span>;
};

const TypeCell = ({ record, t }) => {
  if (record.children !== undefined) {
    return (
      <span className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-md font-medium bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20'>
        {t('标签聚合')}
      </span>
    );
  }
  const opt = typeLabelMap.get(record.type);
  return (
    <span className='inline-flex items-center gap-1.5 text-xs text-ui-text'>
      <span className='inline-flex w-4 h-4 items-center justify-center'>{getChannelIcon(record.type)}</span>
      <span className='truncate'>{opt?.label || t('未知类型')}</span>
    </span>
  );
};

// ── inline number input ─────────────────────────────────

const NumInput = ({ initial, onCommit, min = -999, max }) => {
  const [val, setVal] = useState(initial);
  useEffect(() => setVal(initial), [initial]);
  return (
    <input
      type='number'
      value={val}
      min={min}
      max={max}
      onChange={(e) => setVal(e.target.value)}
      onBlur={(e) => {
        const next = e.target.value;
        if (String(next) !== String(initial)) onCommit(next);
      }}
      onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
      className='w-16 px-2 py-1 text-xs bg-ui-bg border border-ui-border rounded text-ui-text outline-none focus:border-ui-text-3 tabular-nums'
    />
  );
};

// ── row overflow menu ───────────────────────────────────

const RowMenu = ({ items }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const popRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        popRef.current && !popRef.current.contains(e.target)
      ) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onClick);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onClick);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const popW = 180;
    const margin = 8;
    let left = r.right - popW;
    if (left < margin) left = margin;
    if (left + popW + margin > window.innerWidth) left = window.innerWidth - popW - margin;
    setPos({ top: r.bottom + 4, left });
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); setOpen((p) => !p); }}
        className='inline-flex items-center justify-center w-8 h-8 rounded-lg text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors'
      >
        <MoreHorizontal size={14} />
      </button>
      {open && createPortal(
        <div
          ref={popRef}
          className='fixed z-[300] min-w-[180px] bg-ui-bg-elevated border border-ui-border rounded-xl shadow-xl overflow-hidden p-1 animate-dropdown'
          style={{ top: pos.top, left: pos.left }}
        >
          {items.map((it, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setOpen(false); it.onClick?.(); }}
              className={`w-full text-left px-3 py-2 text-sm rounded-lg whitespace-nowrap transition-colors ${
                it.danger
                  ? 'text-ui-danger hover:bg-ui-danger-bg'
                  : 'text-ui-text hover:bg-ui-bg-subtle'
              }`}
            >
              {it.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
};

// ── main table ──────────────────────────────────────────

const COL_DEFS = (t, COLUMN_KEYS) => [
  { key: COLUMN_KEYS.ID, title: 'ID', minW: 'min-w-[60px]' },
  { key: COLUMN_KEYS.NAME, title: t('名称'), minW: 'min-w-[180px]' },
  { key: COLUMN_KEYS.TYPE, title: t('类型'), minW: 'min-w-[140px]' },
  { key: COLUMN_KEYS.GROUP, title: t('分组'), minW: 'min-w-[180px]' },
  { key: COLUMN_KEYS.STATUS, title: t('状态'), minW: 'min-w-[100px]' },
  { key: COLUMN_KEYS.RESPONSE_TIME, title: t('响应'), minW: 'min-w-[80px]' },
  { key: COLUMN_KEYS.BALANCE, title: t('已用/剩余'), minW: 'min-w-[170px]' },
  { key: COLUMN_KEYS.PRIORITY, title: t('优先级'), minW: 'min-w-[80px]' },
  { key: COLUMN_KEYS.WEIGHT, title: t('权重'), minW: 'min-w-[80px]' },
  { key: COLUMN_KEYS.OPERATE, title: '', minW: 'min-w-[260px]', sticky: true },
];

const ChannelsTable = (channelsData) => {
  const {
    channels,
    loading,
    searching,
    enableBatchDelete,
    visibleColumns,
    selectedChannels,
    setSelectedChannels,
    handleRow,
    t,
    COLUMN_KEYS,
    updateChannelBalance,
    manageChannel,
    manageTag,
    submitTagEdit,
    testChannel,
    setCurrentTestChannel,
    setShowModelTestModal,
    setEditingChannel,
    setShowEdit,
    setShowEditTag,
    setEditingTag,
    copySelectedChannel,
    refresh,
    setShowMultiKeyManageModal,
    setCurrentMultiKeyChannel,
  } = channelsData;

  const cols = useMemo(
    () => COL_DEFS(t, COLUMN_KEYS).filter((c) => visibleColumns?.[c.key] !== false),
    [t, COLUMN_KEYS, visibleColumns],
  );

  const allSelected =
    enableBatchDelete &&
    channels.length > 0 &&
    selectedChannels?.length === channels.length;

  const toggleAll = () => {
    setSelectedChannels(allSelected ? [] : [...channels]);
  };

  const toggleOne = (record) => {
    const exists = selectedChannels?.some((r) => r.id === record.id && r.key === record.key);
    if (exists) {
      setSelectedChannels(selectedChannels.filter((r) => !(r.id === record.id && r.key === record.key)));
    } else {
      setSelectedChannels([...(selectedChannels || []), record]);
    }
  };

  const isSelected = (record) =>
    selectedChannels?.some((r) => r.id === record.id && r.key === record.key);

  const renderCell = (col, record, idx) => {
    const isAggregate = record.children !== undefined;
    switch (col.key) {
      case COLUMN_KEYS.ID:
        return <span className='text-xs text-ui-text-3 tabular-nums'>{isAggregate ? '—' : record.id}</span>;

      case COLUMN_KEYS.NAME: {
        const passThrough = isPassThrough(record);
        return (
          <div className='flex items-center gap-1.5 min-w-0'>
            <span className='text-sm text-ui-text truncate'>{record.name}</span>
            {passThrough && (
              <span title={t('已开启请求透传')} className='text-amber-500'>
                <AlertTriangle size={12} />
              </span>
            )}
          </div>
        );
      }

      case COLUMN_KEYS.TYPE:
        return <TypeCell record={record} t={t} />;

      case COLUMN_KEYS.GROUP: {
        const groups = (record.group || '').split(',').filter(Boolean).sort((a, b) => {
          if (a === 'default') return -1;
          if (b === 'default') return 1;
          return a.localeCompare(b);
        });
        return (
          <div className='flex flex-wrap items-center gap-1'>
            {groups.map((g) => (
              <span
                key={g}
                className={`inline-flex items-center px-2 py-0.5 text-[11px] rounded-md font-medium border ${groupColor(g)}`}
              >
                {g}
              </span>
            ))}
          </div>
        );
      }

      case COLUMN_KEYS.STATUS:
        return <StatusPill status={record.status} channelInfo={record.channel_info} />;

      case COLUMN_KEYS.RESPONSE_TIME:
        return <ResponsePill ms={record.response_time} />;

      case COLUMN_KEYS.BALANCE:
        if (isAggregate) {
          return <span className='text-xs text-ui-text-2 tabular-nums'>{renderQuota(record.used_quota)}</span>;
        }
        return (
          <div className='flex items-center gap-2 text-xs tabular-nums'>
            <span className='text-ui-text-2'>{renderQuota(record.used_quota)}</span>
            <span className='text-ui-text-3'>/</span>
            <button
              onClick={(e) => { e.stopPropagation(); updateChannelBalance(record); }}
              className='text-ui-text hover:text-ui-brand transition-colors'
              title={record.type === 57 ? t('查看 Codex 帐号信息与用量') : t('点击更新余额')}
            >
              {record.type === 57 ? t('帐号信息') : renderQuotaWithAmount(record.balance)}
            </button>
          </div>
        );

      case COLUMN_KEYS.PRIORITY:
        return (
          <NumInput
            initial={record.priority}
            min={-999}
            onCommit={(v) => {
              if (isAggregate) {
                showConfirm({
                  title: t('修改子渠道优先级'),
                  content: t('确定要修改所有子渠道优先级为 ') + v + t(' 吗？'),
                  onOk: () => v !== '' && submitTagEdit('priority', { tag: record.key, priority: v }),
                });
              } else {
                manageChannel(record.id, 'priority', record, v);
              }
            }}
          />
        );

      case COLUMN_KEYS.WEIGHT:
        return (
          <NumInput
            initial={record.weight}
            min={0}
            onCommit={(v) => {
              if (isAggregate) {
                showConfirm({
                  title: t('修改子渠道权重'),
                  content: t('确定要修改所有子渠道权重为 ') + v + t(' 吗？'),
                  onOk: () => v !== '' && submitTagEdit('weight', { tag: record.key, weight: v }),
                });
              } else {
                manageChannel(record.id, 'weight', record, v);
              }
            }}
          />
        );

      case COLUMN_KEYS.OPERATE: {
        if (isAggregate) {
          return (
            <div className='flex items-center justify-end gap-1 flex-wrap'>
              <ActionBtn onClick={() => manageTag(record.key, 'enable')} title={t('启用全部')}>
                <Power size={11} />
                {t('启用')}
              </ActionBtn>
              <ActionBtn onClick={() => manageTag(record.key, 'disable')} title={t('禁用全部')}>
                {t('禁用')}
              </ActionBtn>
              <ActionBtn onClick={() => { setShowEditTag(true); setEditingTag(record.key); }}>
                <Edit2 size={11} />
                {t('编辑')}
              </ActionBtn>
            </div>
          );
        }
        const overflow = [
          {
            label: t('删除'),
            danger: true,
            onClick: () =>
              showConfirm({
                title: t('确定是否要删除此渠道？'),
                content: t('此修改将不可逆'),
                danger: true,
                onOk: async () => {
                  await manageChannel(record.id, 'delete', record);
                  refresh();
                },
              }),
          },
          {
            label: t('复制'),
            onClick: () =>
              showConfirm({
                title: t('确定是否要复制此渠道？'),
                content: t('复制渠道的所有信息'),
                onOk: () => copySelectedChannel(record),
              }),
          },
        ];
        if (record.channel_info?.is_multi_key) {
          overflow.unshift({
            label: t('多密钥管理'),
            onClick: () => { setCurrentMultiKeyChannel(record); setShowMultiKeyManageModal(true); },
          });
        }
        return (
          <div className='flex items-center justify-end gap-1'>
            <ActionBtn onClick={() => testChannel(record, '')}>
              <FlaskConical size={11} />
              {t('测试')}
            </ActionBtn>
            <ActionBtn onClick={() => { setCurrentTestChannel(record); setShowModelTestModal(true); }} title={t('选择模型测试')}>
              <ChevronDown size={11} />
            </ActionBtn>
            {record.status === 1 ? (
              <ActionBtn danger onClick={() => manageChannel(record.id, 'disable', record)}>
                {t('禁用')}
              </ActionBtn>
            ) : (
              <ActionBtn onClick={() => manageChannel(record.id, 'enable', record)}>
                {t('启用')}
              </ActionBtn>
            )}
            <ActionBtn onClick={() => { setEditingChannel(record); setShowEdit(true); }}>
              <Edit2 size={11} />
              {t('编辑')}
            </ActionBtn>
            <RowMenu items={overflow} />
          </div>
        );
      }

      default:
        return null;
    }
  };

  if (loading || searching) {
    return (
      <div className='py-16 text-center text-ui-text-3 text-sm'>
        <RefreshCw size={16} className='inline-block animate-spin mr-2 align-text-bottom' />
        {t('加载中...')}
      </div>
    );
  }

  if (!channels.length) {
    return <div className='py-16 text-center text-ui-text-3 text-sm'>{t('暂无渠道')}</div>;
  }

  return (
    <div className='overflow-x-auto nice-scroll'>
      <table className='w-full text-sm border-collapse'>
        <thead>
          <tr className='border-b border-ui-border bg-ui-bg-subtle/50 text-[11px] uppercase tracking-wider text-ui-text-3'>
            {enableBatchDelete && (
              <th className='w-10 px-3 py-2.5'>
                <input
                  type='checkbox'
                  checked={allSelected}
                  onChange={toggleAll}
                  className='w-3.5 h-3.5 cursor-pointer accent-current'
                />
              </th>
            )}
            {cols.map((c) => (
              <th
                key={c.key}
                className={`text-left px-3 py-2.5 font-medium whitespace-nowrap ${c.minW || ''} ${
                  c.sticky ? 'sticky right-0 bg-ui-bg-subtle/80 backdrop-blur-sm text-right' : ''
                }`}
              >
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {channels.map((record, i) => {
            const rowProps = handleRow ? handleRow(record, i) : {};
            return (
              <tr
                key={record.id || record.key || i}
                {...rowProps}
                className={`border-b border-ui-divider last:border-b-0 hover:bg-ui-bg-subtle/40 transition-colors ${rowProps.className || ''}`}
              >
                {enableBatchDelete && (
                  <td className='px-3 py-3 align-middle' onClick={(e) => e.stopPropagation()}>
                    <input
                      type='checkbox'
                      checked={isSelected(record)}
                      onChange={() => toggleOne(record)}
                      className='w-3.5 h-3.5 cursor-pointer accent-current'
                    />
                  </td>
                )}
                {cols.map((c) => (
                  <td
                    key={c.key}
                    className={`px-3 py-3 align-middle ${
                      c.sticky ? 'sticky right-0 text-right' : ''
                    }`}
                    style={c.sticky ? { backgroundColor: 'var(--page-bg)' } : undefined}
                  >
                    {renderCell(c, record, i)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const ActionBtn = ({ children, onClick, danger, title }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
    title={title}
    className={`inline-flex items-center gap-1 px-2 h-7 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
      danger
        ? 'text-ui-danger hover:bg-ui-danger-bg'
        : 'text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle'
    }`}
  >
    {children}
  </button>
);

export default ChannelsTable;

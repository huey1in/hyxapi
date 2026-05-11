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

import React from 'react';
import {
  timestamp2string,
  renderGroup,
  renderQuota,
  getModelCategories,
  showError,
} from '../../../helpers';
import { Tag } from '../../ui';
import { Copy, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { showConfirm } from '../../common/ConfirmDialog';

// progress color helper
const getProgressColor = (pct) => {
  if (pct === 100) return '#22c55e';
  if (pct <= 10) return '#ef4444';
  if (pct <= 30) return '#f59e0b';
  return '#3b82f6';
};

// Render functions
function renderTimestamp(timestamp) {
  return <>{timestamp2string(timestamp)}</>;
}

// Render status column only (no usage)
const renderStatus = (text, record, t) => {
  const enabled = text === 1;

  let color = 'gray';
  let tagText = t('未知状态');
  if (enabled) {
    color = 'green';
    tagText = t('已启用');
  } else if (text === 2) {
    color = 'red';
    tagText = t('已禁用');
  } else if (text === 3) {
    color = 'amber';
    tagText = t('已过期');
  } else if (text === 4) {
    color = 'gray';
    tagText = t('已耗尽');
  }

  return (
    <Tag color={color} size='sm'>
      {tagText}
    </Tag>
  );
};

// Render group column
const renderGroupColumn = (text, record, t, groupRatios = {}) => {
  const ratio = groupRatios[text];
  return (
    <span className='flex items-center gap-1'>
      {renderGroup(text)}
      {ratio !== undefined && (
        <span className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-md font-medium bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'>
          {ratio}x
        </span>
      )}
    </span>
  );
};

// Render token key column with show/hide and copy functionality
const renderTokenKey = (
  text,
  record,
  showKeys,
  resolvedTokenKeys,
  loadingTokenKeys,
  toggleTokenVisibility,
  copyTokenKey,
  copyTokenConnectionString,
  t,
) => {
  const revealed = !!showKeys[record.id];
  const loading = !!loadingTokenKeys[record.id];
  const keyValue =
    revealed && resolvedTokenKeys[record.id]
      ? resolvedTokenKeys[record.id]
      : record.key || '';
  const displayedKey = keyValue ? `sk-${keyValue}` : '';

  return (
    <div className='w-[200px]'>
      <div className='flex items-center border border-ui-border rounded-xl overflow-hidden'>
        <input
          readOnly
          value={displayedKey}
          className='flex-1 min-w-0 px-3 py-1.5 text-sm bg-transparent text-ui-text outline-none'
        />
        <div className='flex items-center pr-1'>
          <button
            className='inline-flex items-center justify-center w-7 h-7 rounded-lg text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors'
            aria-label='toggle token visibility'
            onClick={async (e) => {
              e.stopPropagation();
              await toggleTokenVisibility(record);
            }}
          >
            {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <TokenCopyDropdown
            record={record}
            copyTokenKey={copyTokenKey}
            copyTokenConnectionString={copyTokenConnectionString}
            loading={loading}
            t={t}
          />
        </div>
      </div>
    </div>
  );
};

// Simple dropdown for copy actions
const TokenCopyDropdown = ({ record, copyTokenKey, copyTokenConnectionString, loading, t }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className='relative' ref={ref}>
      <button
        className='inline-flex items-center justify-center w-7 h-7 rounded-lg text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors'
        aria-label='copy token key'
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
      >
        <Copy size={14} />
      </button>
      {open && (
        <div className='absolute right-0 top-full mt-1 z-50 bg-ui-bg-elevated border border-ui-border rounded-xl shadow-lg py-1 min-w-[140px]'>
          <button
            className='w-full text-left px-3 py-1.5 text-sm text-ui-text hover:bg-ui-bg-subtle transition-colors'
            onClick={(e) => {
              e.stopPropagation();
              copyTokenKey(record);
              setOpen(false);
            }}
          >
            {t('复制密钥')}
          </button>
          <button
            className='w-full text-left px-3 py-1.5 text-sm text-ui-text hover:bg-ui-bg-subtle transition-colors'
            onClick={(e) => {
              e.stopPropagation();
              copyTokenConnectionString(record);
              setOpen(false);
            }}
          >
            {t('复制连接信息')}
          </button>
        </div>
      )}
    </div>
  );
};

// Render model limits column
const renderModelLimits = (text, record, t) => {
  if (record.model_limits_enabled && text) {
    const models = text.split(',').filter(Boolean);
    const categories = getModelCategories(t);

    const vendorAvatars = [];
    const matchedModels = new Set();
    Object.entries(categories).forEach(([key, category]) => {
      if (key === 'all') return;
      if (!category.icon || !category.filter) return;
      const vendorModels = models.filter((m) =>
        category.filter({ model_name: m }),
      );
      if (vendorModels.length > 0) {
        vendorAvatars.push(
          <span
            key={key}
            title={vendorModels.join(', ')}
            className='inline-flex items-center justify-center w-6 h-6 rounded-full bg-ui-bg-subtle text-xs'
          >
            {category.icon}
          </span>,
        );
        vendorModels.forEach((m) => matchedModels.add(m));
      }
    });

    const unmatchedModels = models.filter((m) => !matchedModels.has(m));
    if (unmatchedModels.length > 0) {
      vendorAvatars.push(
        <span
          key='unknown'
          title={unmatchedModels.join(', ')}
          className='inline-flex items-center justify-center w-6 h-6 rounded-full bg-ui-bg-subtle text-[10px]'
        >
          {t('其他')}
        </span>,
      );
    }

    return <div className='flex items-center -space-x-1'>{vendorAvatars}</div>;
  } else {
    return (
      <span className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-md font-medium bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20'>
        {t('无限制')}
      </span>
    );
  }
};

// Render IP restrictions column
const renderAllowIps = (text, t) => {
  if (!text || text.trim() === '') {
    return (
      <span className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-md font-medium bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20'>
        {t('无限制')}
      </span>
    );
  }

  const ips = text
    .split('\n')
    .map((ip) => ip.trim())
    .filter(Boolean);

  const displayIps = ips.slice(0, 1);
  const extraCount = ips.length - displayIps.length;

  const ipTags = displayIps.map((ip, idx) => (
    <span key={idx} className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-md font-medium bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20'>
      {ip}
    </span>
  ));

  if (extraCount > 0) {
    ipTags.push(
      <span
        key='extra'
        title={ips.slice(1).join(', ')}
        className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-md font-medium bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20 cursor-help'
      >
        {'+' + extraCount}
      </span>,
    );
  }

  return <div className='flex flex-wrap gap-1'>{ipTags}</div>;
};

// Render separate quota usage column
const renderQuotaUsage = (text, record, t) => {
  const used = parseInt(record.used_quota) || 0;
  const remain = parseInt(record.remain_quota) || 0;
  const total = used + remain;
  if (record.unlimited_quota) {
    return (
      <span
        className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-md font-medium bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20 cursor-help'
        title={`${t('已用额度')}: ${renderQuota(used)}`}
      >
        {t('无限额度')}
      </span>
    );
  }
  const percent = total > 0 ? (remain / total) * 100 : 0;
  const tooltipText = `${t('已用额度')}: ${renderQuota(used)} | ${t('剩余额度')}: ${renderQuota(remain)} (${percent.toFixed(0)}%) | ${t('总额度')}: ${renderQuota(total)}`;
  return (
    <span
      className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-md font-medium bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20 cursor-help'
      title={tooltipText}
    >
      <span className='flex flex-col items-end'>
        <span className='text-xs leading-none'>{`${renderQuota(remain)} / ${renderQuota(total)}`}</span>
        <span className='w-full mt-0.5 h-1 rounded-full bg-ui-border overflow-hidden'>
          <span
            className='block h-full rounded-full transition-all'
            style={{ width: `${percent}%`, backgroundColor: getProgressColor(percent) }}
          />
        </span>
      </span>
    </span>
  );
};

// Render operations column
const renderOperations = (
  text,
  record,
  setEditingToken,
  setShowEdit,
  manageToken,
  refresh,
  t,
) => {
  return (
    <div className='flex flex-wrap gap-1.5'>
      {record.status === 1 ? (
        <button
          className='inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-ui-danger text-white hover:opacity-90 transition-colors'
          onClick={async () => {
            await manageToken(record.id, 'disable', record);
            await refresh();
          }}
        >
          {t('禁用')}
        </button>
      ) : (
        <button
          className='inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors'
          onClick={async () => {
            await manageToken(record.id, 'enable', record);
            await refresh();
          }}
        >
          {t('启用')}
        </button>
      )}

      <button
        className='inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors'
        onClick={() => {
          setEditingToken(record);
          setShowEdit(true);
        }}
      >
        {t('编辑')}
      </button>

      <button
        className='inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-ui-danger text-white hover:opacity-90 transition-colors'
        onClick={() => {
          showConfirm({
            title: t('确定是否要删除此令牌？'),
            content: t('此修改将不可逆'),
            danger: true,
            onOk: async () => {
              await manageToken(record.id, 'delete', record);
              await refresh();
            },
          });
        }}
      >
        {t('删除')}
      </button>
    </div>
  );
};

export const getTokensColumns = ({
  t,
  showKeys,
  resolvedTokenKeys,
  loadingTokenKeys,
  toggleTokenVisibility,
  copyTokenKey,
  copyTokenConnectionString,
  manageToken,
  setEditingToken,
  setShowEdit,
  refresh,
  groupRatios = {},
}) => {
  return [
    {
      title: t('名称'),
      dataIndex: 'name',
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      key: 'status',
      render: (text, record) => renderStatus(text, record, t),
    },
    {
      title: t('剩余额度/总额度'),
      key: 'quota_usage',
      render: (text, record) => renderQuotaUsage(text, record, t),
    },
    {
      title: t('分组'),
      dataIndex: 'group',
      key: 'group',
      render: (text, record) => renderGroupColumn(text, record, t, groupRatios),
    },
    {
      title: t('密钥'),
      key: 'token_key',
      render: (text, record) =>
        renderTokenKey(
          text,
          record,
          showKeys,
          resolvedTokenKeys,
          loadingTokenKeys,
          toggleTokenVisibility,
          copyTokenKey,
          copyTokenConnectionString,
          t,
        ),
    },
    {
      title: t('可用模型'),
      dataIndex: 'model_limits',
      render: (text, record) => renderModelLimits(text, record, t),
    },
    {
      title: t('IP限制'),
      dataIndex: 'allow_ips',
      render: (text) => renderAllowIps(text, t),
    },
    {
      title: t('创建时间'),
      dataIndex: 'created_time',
      render: (text, record, index) => {
        return <div>{renderTimestamp(text)}</div>;
      },
    },
    {
      title: t('最后使用时间'),
      dataIndex: 'accessed_time',
      render: (text, record, index) => {
        return <div>{text ? renderTimestamp(text) : '-'}</div>;
      },
    },
    {
      title: t('过期时间'),
      dataIndex: 'expired_time',
      render: (text, record, index) => {
        return (
          <div>
            {record.expired_time === -1 ? t('永不过期') : renderTimestamp(text)}
          </div>
        );
      },
    },
    {
      title: '',
      dataIndex: 'operate',
      fixed: 'right',
      render: (text, record, index) =>
        renderOperations(
          text,
          record,
          setEditingToken,
          setShowEdit,
          manageToken,
          refresh,
          t,
        ),
    },
  ];
};

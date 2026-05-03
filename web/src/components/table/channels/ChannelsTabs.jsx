/*
 * Channels page tabs — pill-style horizontal scroller.
 */
import React from 'react';
import { CHANNEL_OPTIONS } from '../../../constants';
import { getChannelIcon } from '../../../helpers';

const ChannelsTabs = ({
  enableTagMode,
  activeTypeKey,
  setActiveTypeKey,
  channelTypeCounts,
  availableTypeKeys,
  loadChannels,
  pageSize,
  idSort,
  setActivePage,
  t,
}) => {
  if (enableTagMode) return null;

  const handle = (key) => {
    setActiveTypeKey(key);
    setActivePage(1);
    loadChannels(1, pageSize, idSort, enableTagMode, key);
  };

  const items = [
    { key: 'all', label: t('全部'), icon: null, count: channelTypeCounts['all'] || 0 },
    ...CHANNEL_OPTIONS.filter((o) => availableTypeKeys.includes(String(o.value))).map((o) => ({
      key: String(o.value),
      label: o.label,
      icon: getChannelIcon(o.value),
      count: channelTypeCounts[o.value] || 0,
    })),
  ];

  return (
    <div className='flex items-center gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1 py-1'>
      {items.map((it) => {
        const active = activeTypeKey === it.key;
        return (
          <button
            key={it.key}
            onClick={() => handle(it.key)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md whitespace-nowrap flex-shrink-0 transition-colors ${
              active
                ? 'bg-ui-bg-subtle text-ui-text font-semibold border border-ui-text-3'
                : 'border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle'
            }`}
          >
            {it.icon && <span className='inline-flex'>{it.icon}</span>}
            {it.label}
            <span
              className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded text-[10px] tabular-nums ${
                active ? 'bg-ui-accent text-ui-accent-fg' : 'bg-ui-bg-subtle text-ui-text-3 border border-ui-border'
              }`}
            >
              {it.count}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default ChannelsTabs;

/*
 * Channels page tabs — pill-style horizontal scroller.
 */
import React from 'react';
import { CHANNEL_OPTIONS } from '../../../constants';
import { getChannelIcon } from '../../../helpers';
import { Button } from '../../ui';

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
    <div className='flex items-center gap-1.5 overflow-x-auto scrollbar-hide px-1 py-1.5'>
      {items.map((it) => {
        const active = activeTypeKey === it.key;
        return (
          <Button
            key={it.key}
            variant='chip'
            size='sm'
            selected={active}
            onClick={() => handle(it.key)}
            icon={it.icon ? <span className='inline-flex'>{it.icon}</span> : undefined}
          >
            {it.label}
            <span
              className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded text-[11px] tabular-nums ml-1.5 ${
                active ? 'bg-ui-accent-fg/20 text-ui-accent-fg' : 'bg-ui-bg-subtle text-ui-text-3'
              }`}
            >
              {it.count}
            </span>
          </Button>
        );
      })}
    </div>
  );
};

export default ChannelsTabs;

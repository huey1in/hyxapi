/*
 * Side info card with tabs: API / Announcements / FAQ / Uptime.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import ChevronDownIcon from '../../layout/headerbar/icons/ChevronDownIcon';
import CopyIcon from '../../layout/icons/CopyIcon';
import SpeedIcon from '../../layout/icons/SpeedIcon';
import {
  handleCopyUrl,
  handleSpeedTest,
  getUptimeStatusColor,
  getUptimeStatusText,
} from '../../../helpers/dashboard';
import { UPTIME_STATUS_MAP } from '../../../constants/dashboard.constants';
import { IconButton, Tabs as UITabs, Button, Card } from '../../ui';

// ── primitives ──────────────────────────────────────────

const Empty = ({ text }) => (
  <div className='flex flex-col items-center justify-center h-full min-h-[220px] py-8 text-ui-text-3'>
    <p className='text-xs'>{text}</p>
  </div>
);

const LoadingState = () => (
  <div className='flex items-center justify-center h-full min-h-[220px] py-8 text-ui-text-3'>
    <Loader2 size={20} className='animate-spin' />
  </div>
);

const ListContainer = ({ children }) => (
  <div className='divide-y divide-ui-divider h-full overflow-y-auto'>
    {children}
  </div>
);

const TYPE_DOT = {
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
};

// ── ApiInfo ─────────────────────────────────────────────

const ApiInfoList = ({ items, loading, t }) => {
  if (loading && (!items || items.length === 0)) return <LoadingState />;
  if (!items?.length) return <Empty text={t('暂无 API 信息')} />;
  return (
    <ListContainer>
      {items.map((item, i) => (
        <div key={i} className='group px-5 py-3.5 hover:bg-ui-bg-subtle/50 transition-colors'>
          <div className='flex items-center justify-between gap-2 mb-1'>
            <div className='flex items-center gap-2 min-w-0'>
              {item.color && (
                <span
                  className='w-1.5 h-1.5 rounded-full flex-shrink-0'
                  style={{ background: item.color }}
                />
              )}
              <span className='text-[13px] font-medium text-ui-text truncate'>
                {item.route || item.name || item.url}
              </span>
            </div>
            <div className='flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity'>
              <IconButton
                icon={() => <CopyIcon size={12} />}
                size='sm'
                onClick={() => handleCopyUrl(item.url, t)}
                title={t('复制')}
                className='w-7 h-7'
              />
              {item.url && (
                <IconButton
                  icon={() => <SpeedIcon size={12} />}
                  size='sm'
                  onClick={() => handleSpeedTest(item.url)}
                  title={t('测速')}
                  className='w-7 h-7'
                />
              )}
            </div>
          </div>
          <code className='block text-[11px] font-mono text-ui-text-3 truncate'>
            {item.url}
          </code>
        </div>
      ))}
    </ListContainer>
  );
};

// ── Announcements ──────────────────────────────────────

const AnnouncementsList = ({ items, loading, t }) => {
  if (loading && (!items || items.length === 0)) return <LoadingState />;
  if (!items?.length) return <Empty text={t('暂无公告')} />;
  return (
    <ListContainer>
      {items.slice(0, 30).map((item, i) => {
        const color = TYPE_DOT[item.type] || 'var(--ui-text-3)';
        return (
          <div key={i} className='px-5 py-3.5 hover:bg-ui-bg-subtle/50 transition-colors'>
            <div className='flex items-center gap-2 mb-1.5'>
              <span
                className='w-1.5 h-1.5 rounded-full flex-shrink-0'
                style={{ background: color }}
              />
              <span className='text-[11px] text-ui-text-3 tabular-nums'>
                {item.relative ? `${item.relative} · ` : ''}
                {item.time}
              </span>
            </div>
            <p className='text-[13px] text-ui-text leading-relaxed pl-3.5'>
              {item.content}
            </p>
          </div>
        );
      })}
    </ListContainer>
  );
};

// ── FAQ ────────────────────────────────────────────────

const FaqRow = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button
        variant='ghost'
        block
        onClick={() => setOpen((o) => !o)}
        className='justify-between'
        iconRight={
          <ChevronDownIcon
            size={14}
            className={`text-ui-text-3 flex-shrink-0 transition-transform ${open ? '' : '-rotate-90'}`}
          />
        }
      >
        <span className='flex-1 font-medium text-left'>{q}</span>
      </Button>
      {open && (
        <div className='px-5 pb-3.5 pt-0 text-[13px] text-ui-text-2 leading-relaxed'>
          {a}
        </div>
      )}
    </div>
  );
};

const FaqList = ({ items, loading, t }) => {
  if (loading && (!items || items.length === 0)) return <LoadingState />;
  if (!items?.length) return <Empty text={t('暂无问答')} />;
  return (
    <ListContainer>
      {items.map((item, i) => (
        <FaqRow key={i} q={item.question} a={item.answer} />
      ))}
    </ListContainer>
  );
};

// ── Uptime ─────────────────────────────────────────────

const UptimeList = ({ data, loading, activeGroup, setActiveGroup, t }) => {
  if (loading) return <LoadingState />;
  if (!data?.length) return <Empty text={t('暂无服务')} />;

  const groups = data.map((g, i) => ({ key: String(i), label: g.categoryName }));
  const current = data[Number(activeGroup) || 0];
  const monitors = current?.monitorList || [];

  return (
    <div className='h-full flex flex-col'>
      {groups.length > 1 && (
        <div className='px-3 py-2 border-b border-ui-divider overflow-x-auto scrollbar-hide flex-shrink-0'>
          <UITabs
            size='sm'
            value={activeGroup}
            onChange={setActiveGroup}
            items={groups.map((g) => ({ value: g.key, label: g.label }))}
          />
        </div>
      )}
      {monitors.length === 0 ? (
        <Empty text={t('暂无监控')} />
      ) : (
        <div className='flex-1 min-h-0 overflow-y-auto'>
          <ul className='divide-y divide-ui-divider'>
            {monitors.map((m, i) => {
              const color = getUptimeStatusColor(m.status, UPTIME_STATUS_MAP);
              const text = getUptimeStatusText(m.status, UPTIME_STATUS_MAP, t);
              const pct = ((m.uptime || 0) * 100).toFixed(2);
              return (
                <li key={i} className='px-5 py-3'>
                  <div className='flex items-center justify-between gap-2 mb-1.5'>
                    <div className='flex items-center gap-2 min-w-0'>
                      <span
                        className='w-1.5 h-1.5 rounded-full flex-shrink-0'
                        style={{ background: color }}
                      />
                      <span className='text-[13px] text-ui-text truncate'>{m.name}</span>
                    </div>
                    <span className='text-[11px] text-ui-text-3 tabular-nums flex-shrink-0'>
                      {pct}%
                    </span>
                  </div>
                  <div className='flex items-center gap-2 pl-3.5'>
                    <span className='text-[10px] text-ui-text-3 w-12 shrink-0'>{text}</span>
                    <div className='flex-1 h-1 rounded-full bg-ui-bg-subtle overflow-hidden'>
                      <div
                        className='h-full rounded-full transition-all'
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

// ── Main InfoCard ──────────────────────────────────────

const TAB_META = {
  api: { label: '接入点' },
  news: { label: '公告' },
  faq: { label: '常见问题' },
  uptime: { label: '服务状态' },
};

const InfoCard = ({
  apiInfoEnabled,
  announcementsEnabled,
  faqEnabled,
  uptimeEnabled,
  apiInfoData,
  announcementData,
  faqData,
  uptimeData,
  uptimeLoading,
  loading,
  activeUptimeTab,
  setActiveUptimeTab,
  t,
}) => {
  const tabs = useMemo(() => {
    const out = [];
    if (apiInfoEnabled) out.push({ key: 'api', ...TAB_META.api });
    if (announcementsEnabled) out.push({ key: 'news', ...TAB_META.news });
    if (faqEnabled) out.push({ key: 'faq', ...TAB_META.faq });
    if (uptimeEnabled) out.push({ key: 'uptime', ...TAB_META.uptime });
    return out;
  }, [apiInfoEnabled, announcementsEnabled, faqEnabled, uptimeEnabled]);

  const [active, setActive] = useState(tabs[0]?.key);
  useEffect(() => {
    if (!tabs.find((tb) => tb.key === active)) setActive(tabs[0]?.key);
  }, [tabs, active]);

  if (tabs.length === 0) return null;

  return (
    <Card
      padding='none'
      className='h-full flex flex-col'
      bodyClassName='flex-1 min-h-0 overflow-hidden'
      header={
        <div className='overflow-x-auto scrollbar-hide'>
          <UITabs
            size='sm'
            value={active}
            onChange={setActive}
            items={tabs.map(({ key, label }) => ({ value: key, label: t(label) }))}
          />
        </div>
      }
      headerClassName='px-2 py-2 flex-shrink-0'
    >
      {active === 'api' && <ApiInfoList items={apiInfoData} loading={loading} t={t} />}
      {active === 'news' && <AnnouncementsList items={announcementData} loading={loading} t={t} />}
      {active === 'faq' && <FaqList items={faqData} loading={loading} t={t} />}
      {active === 'uptime' && (
        <UptimeList
          data={uptimeData}
          loading={uptimeLoading}
          activeGroup={activeUptimeTab}
          setActiveGroup={setActiveUptimeTab}
          t={t}
        />
      )}
    </Card>
  );
};

export default InfoCard;

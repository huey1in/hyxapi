/*
 * Side info card with tabs: API Info / Announcements / FAQ / Uptime.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Globe, Inbox, HelpCircle, Activity, Loader2,
  ChevronDown, ChevronRight, Copy, Gauge,
} from 'lucide-react';
import Card from './Card';
import { handleCopyUrl, handleSpeedTest, getUptimeStatusColor, getUptimeStatusText } from '../../../helpers/dashboard';
import { UPTIME_STATUS_MAP } from '../../../constants/dashboard.constants';

// ── primitives ──────────────────────────────────────────

const Empty = ({ Icon = Inbox, text }) => (
  <div className='flex flex-col items-center justify-center py-12 text-ui-text-3'>
    <Icon size={20} className='mb-2' />
    <p className='text-xs'>{text}</p>
  </div>
);

const ListContainer = ({ children }) => (
  <div className='divide-y divide-ui-divider max-h-[420px] overflow-y-auto'>
    {children}
  </div>
);

// ── ApiInfo panel ───────────────────────────────────────

const ApiInfoList = ({ items, t }) => {
  if (!items?.length) return <Empty Icon={Globe} text={t('暂无 API 信息')} />;
  return (
    <ListContainer>
      {items.map((item, i) => (
        <div key={i} className='px-5 py-3 hover:bg-ui-bg-subtle/40 transition-colors'>
          <div className='flex items-center justify-between gap-2 mb-1'>
            <span className='text-sm font-medium text-ui-text truncate'>
              {item.route || item.name || item.url}
            </span>
            <div className='flex items-center gap-0.5 flex-shrink-0'>
              <button
                onClick={() => handleCopyUrl(item.url, t)}
                title={t('复制')}
                className='p-1 rounded text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors'
              >
                <Copy size={12} />
              </button>
              {item.url && (
                <button
                  onClick={() => handleSpeedTest(item.url)}
                  title={t('测速')}
                  className='p-1 rounded text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors'
                >
                  <Gauge size={12} />
                </button>
              )}
            </div>
          </div>
          <code className='block text-[11px] font-mono text-ui-text-2 truncate'>
            {item.url}
          </code>
        </div>
      ))}
    </ListContainer>
  );
};

// ── Announcements panel ─────────────────────────────────

const AnnouncementsList = ({ items, t }) => {
  if (!items?.length) return <Empty Icon={Inbox} text={t('暂无公告')} />;
  const colorMap = { success: '#22c55e', warning: '#f59e0b', error: '#ef4444' };
  return (
    <ListContainer>
      {items.slice(0, 30).map((item, i) => {
        const color = colorMap[item.type] || 'var(--ui-text-3)';
        return (
          <div key={i} className='px-5 py-3'>
            <div className='flex items-center gap-2 mb-1.5'>
              <span className='w-1.5 h-1.5 rounded-full flex-shrink-0' style={{ background: color }} />
              <span className='text-[11px] text-ui-text-3'>
                {item.relative ? `${item.relative} · ` : ''}{item.time}
              </span>
            </div>
            <p className='text-sm text-ui-text leading-relaxed pl-3.5'>
              {item.content}
            </p>
          </div>
        );
      })}
    </ListContainer>
  );
};

// ── FAQ panel ───────────────────────────────────────────

const FaqRow = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className='flex items-center justify-between gap-3 w-full px-5 py-3 text-left text-sm text-ui-text hover:bg-ui-bg-subtle/40 transition-colors'
      >
        <span className='flex-1'>{q}</span>
        {open ? (
          <ChevronDown size={14} className='text-ui-text-3 flex-shrink-0' />
        ) : (
          <ChevronRight size={14} className='text-ui-text-3 flex-shrink-0' />
        )}
      </button>
      {open && (
        <div className='px-5 pb-3 text-sm text-ui-text-2 leading-relaxed'>{a}</div>
      )}
    </div>
  );
};

const FaqList = ({ items, t }) => {
  if (!items?.length) return <Empty Icon={HelpCircle} text={t('暂无问答')} />;
  return (
    <ListContainer>
      {items.map((item, i) => (
        <FaqRow key={i} q={item.question} a={item.answer} />
      ))}
    </ListContainer>
  );
};

// ── Uptime panel ────────────────────────────────────────

const UptimeList = ({ data, loading, activeGroup, setActiveGroup, t }) => {
  if (loading) {
    return (
      <div className='flex items-center justify-center py-12 text-ui-text-3'>
        <Loader2 size={18} className='animate-spin' />
      </div>
    );
  }
  if (!data?.length) return <Empty Icon={Activity} text={t('暂无服务')} />;

  const groups = data.map((g, i) => ({ key: String(i), label: g.categoryName }));
  const current = data[Number(activeGroup) || 0];
  const monitors = current?.monitorList || [];

  return (
    <div>
      {groups.length > 1 && (
        <div className='flex gap-0.5 px-3 py-2 border-b border-ui-divider overflow-x-auto'>
          {groups.map((g) => (
            <button
              key={g.key}
              onClick={() => setActiveGroup(g.key)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap ${
                activeGroup === g.key
                  ? 'bg-ui-bg-subtle text-ui-text font-medium'
                  : 'text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}
      {monitors.length === 0 ? (
        <Empty Icon={Activity} text={t('暂无监控')} />
      ) : (
        <ListContainer>
          {monitors.map((m, i) => {
            const color = getUptimeStatusColor(m.status, UPTIME_STATUS_MAP);
            const text = getUptimeStatusText(m.status, UPTIME_STATUS_MAP, t);
            const pct = ((m.uptime || 0) * 100).toFixed(2);
            return (
              <div key={i} className='px-5 py-3'>
                <div className='flex items-center justify-between gap-2 mb-1'>
                  <div className='flex items-center gap-2 min-w-0'>
                    <span className='w-1.5 h-1.5 rounded-full flex-shrink-0' style={{ background: color }} />
                    <span className='text-sm text-ui-text truncate'>{m.name}</span>
                  </div>
                  <span className='text-xs text-ui-text-3 tabular-nums flex-shrink-0'>{pct}%</span>
                </div>
                <div className='flex items-center gap-2 pl-3.5'>
                  <span className='text-[11px] text-ui-text-3'>{text}</span>
                  <div className='flex-1 h-1 rounded-full bg-ui-bg-subtle overflow-hidden'>
                    <div
                      className='h-full rounded-full transition-all'
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </ListContainer>
      )}
    </div>
  );
};

// ── Main InfoCard ───────────────────────────────────────

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
  activeUptimeTab,
  setActiveUptimeTab,
  t,
}) => {
  const tabs = useMemo(() => {
    const out = [];
    if (apiInfoEnabled) out.push({ key: 'api', label: t('API'), Icon: Globe });
    if (announcementsEnabled) out.push({ key: 'news', label: t('公告'), Icon: Inbox });
    if (faqEnabled) out.push({ key: 'faq', label: t('FAQ'), Icon: HelpCircle });
    if (uptimeEnabled) out.push({ key: 'uptime', label: t('状态'), Icon: Activity });
    return out;
  }, [apiInfoEnabled, announcementsEnabled, faqEnabled, uptimeEnabled, t]);

  const [active, setActive] = useState(tabs[0]?.key);
  useEffect(() => {
    if (!tabs.find((tb) => tb.key === active)) setActive(tabs[0]?.key);
  }, [tabs, active]);

  if (tabs.length === 0) return null;

  return (
    <Card
      title={
        <span className='text-sm font-semibold text-ui-text'>{t('信息')}</span>
      }
      action={
        <div className='flex items-center gap-0.5 -mr-1'>
          {tabs.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActive(key)}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors ${
                active === key
                  ? 'bg-ui-bg-subtle text-ui-text font-medium'
                  : 'text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle'
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      }
      bodyClass='p-0'
    >
      {active === 'api' && <ApiInfoList items={apiInfoData} t={t} />}
      {active === 'news' && <AnnouncementsList items={announcementData} t={t} />}
      {active === 'faq' && <FaqList items={faqData} t={t} />}
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

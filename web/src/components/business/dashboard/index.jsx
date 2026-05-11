/*
 * Dashboard — 与 web-backup 同构（去掉 VChart，图表用 Skeleton 占位；
 *              InfoCard / SearchModal 简化但保留视觉位置）。
 */

import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Loader2, Wallet, TrendingUp } from 'lucide-react';
import { UserContext } from '../../../context/User';
import { StatusContext } from '../../../context/Status';
import { renderQuota, renderNumber, getRelativeTime } from '../../../helpers';
import { useDashboardData } from '../../../hooks/dashboard/useDashboardData';
import { useDashboardCharts } from '../../../hooks/dashboard/useDashboardCharts';
import { Button, IconButton, Tabs, Card, Skeleton, Modal, FieldRow, Input } from '../../ui';
import { cn } from '../../ui/tokens';

const StatCard = ({ title, icon: Icon, value, sub, loading }) => (
  <Card>
    <div className='flex items-center gap-2 mb-1.5'>
      {Icon && <Icon size={14} className='text-ui-text-3' />}
      <span className='text-xs text-ui-text-3'>{title}</span>
    </div>
    <div className='text-3xl font-semibold text-ui-text tabular-nums'>
      {loading ? <Skeleton width='160px' height='32px' /> : value}
    </div>
    {sub && <div className='mt-1 text-[11px] text-ui-text-3'>{sub}</div>}
  </Card>
);

const SimpleBarChart = ({ data = [], loading, t, valueLabel = 'quota' }) => {
  const max = useMemo(() => Math.max(...data.map((d) => Number(d.value) || 0), 0), [data]);
  if (loading && data.length === 0) return <Skeleton width='100%' height='240px' />;
  if (data.length === 0) return <div className='h-[240px] flex items-center justify-center text-sm text-ui-text-3'>{t('暂无数据')}</div>;
  return (
    <div className='flex items-end gap-1 h-[240px] px-2 pt-2'>
      {data.map((d, i) => {
        const h = max > 0 ? Math.max(2, (d.value / max) * 220) : 2;
        const fmt = valueLabel === 'count' ? renderNumber(d.value) : renderQuota(d.value, 4);
        return (
          <div key={`${d.time}-${i}`} className='flex-1 flex flex-col items-center justify-end min-w-0' title={`${d.time}：${fmt}`}>
            <div className='w-full bg-ui-accent rounded-t-sm' style={{ height: `${h}px` }} />
            <div className='mt-1 text-[10px] text-ui-text-3 truncate w-full text-center'>{String(d.time).slice(-5)}</div>
          </div>
        );
      })}
    </div>
  );
};

const InfoSidebar = ({ statusState, t }) => {
  const announcements = (statusState?.status?.announcements || []).map((it) => ({
    ...it,
    relative: getRelativeTime(it.publishDate),
  }));
  const apiInfo = statusState?.status?.api_info || [];
  const faq = statusState?.status?.faq || [];

  const [tab, setTab] = useState('api');
  const empty = (msg) => <div className='py-8 text-center text-xs text-ui-text-3'>{msg}</div>;

  return (
    <Card>
      <div className='mb-3'>
        <Tabs
          variant='underline'
          value={tab}
          onChange={setTab}
          items={[
            { value: 'api',          label: t('API 信息') },
            { value: 'announcements', label: t('公告') },
            { value: 'faq',          label: 'FAQ' },
          ]}
        />
      </div>
      <div className='max-h-[300px] overflow-y-auto'>
        {tab === 'api' && (apiInfo.length === 0 ? empty(t('暂无 API 信息')) : (
          <ul className='divide-y divide-ui-divider text-sm'>
            {apiInfo.map((it, i) => (
              <li key={i} className='py-2'>
                <div className='text-ui-text font-medium'>{it.title}</div>
                <div className='text-xs text-ui-text-2 font-mono break-all'>{it.url}</div>
              </li>
            ))}
          </ul>
        ))}
        {tab === 'announcements' && (announcements.length === 0 ? empty(t('暂无公告')) : (
          <ul className='divide-y divide-ui-divider text-sm'>
            {announcements.map((it, i) => (
              <li key={i} className='py-2'>
                <div className='flex items-center justify-between gap-2'>
                  <span className='text-ui-text font-medium'>{it.title}</span>
                  <span className='text-[11px] text-ui-text-3 whitespace-nowrap'>{it.relative}</span>
                </div>
                {it.content && <div className='mt-1 text-xs text-ui-text-2'>{it.content}</div>}
              </li>
            ))}
          </ul>
        ))}
        {tab === 'faq' && (faq.length === 0 ? empty(t('暂无 FAQ')) : (
          <ul className='divide-y divide-ui-divider text-sm'>
            {faq.map((it, i) => (
              <li key={i} className='py-2'>
                <div className='text-ui-text font-medium'>{it.question}</div>
                <div className='mt-0.5 text-xs text-ui-text-2 leading-relaxed'>{it.answer}</div>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </Card>
  );
};

const SimpleSearchModal = ({ open, onClose, onConfirm, dashboardData, t }) => {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  useEffect(() => {
    if (open) {
      setStart(dashboardData?.startTime || '');
      setEnd(dashboardData?.endTime || '');
    }
  }, [open, dashboardData]);
  const submit = async () => {
    dashboardData?.setStartTime?.(start);
    dashboardData?.setEndTime?.(end);
    await onConfirm();
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={t('筛选时间范围')} width={420} onConfirm={submit} confirmText={t('应用')}>
      <FieldRow label={t('开始时间')}>
        <Input type='datetime-local' value={start} onChange={setStart} />
      </FieldRow>
      <FieldRow label={t('结束时间')}>
        <Input type='datetime-local' value={end} onChange={setEnd} />
      </FieldRow>
    </Modal>
  );
};

const Dashboard = () => {
  const { t } = useTranslation();
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);

  const dashboardData = useDashboardData(userState, userDispatch, statusState);
  const dashboardCharts = useDashboardCharts(
    dashboardData.dataExportDefaultTime,
    dashboardData.setTrendData,
    dashboardData.setConsumeQuota,
    dashboardData.setTimes,
    dashboardData.setConsumeTokens,
    dashboardData.setPieData,
    dashboardData.setLineData,
    dashboardData.setModelColors,
    t,
  );

  const [chartTab, setChartTab] = useState('quota');
  const [searchOpen, setSearchOpen] = useState(false);

  const init = async () => {
    const data = await dashboardData.loadQuotaData();
    if (data?.length > 0) dashboardCharts.updateChartData(data);
    await dashboardData.loadUptimeData?.();
  };

  const handleRefresh = async () => {
    const data = await dashboardData.refresh();
    if (data?.length > 0) dashboardCharts.updateChartData(data);
  };

  useEffect(() => { init(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  /* 数据派生 */
  const timeQuotaData = useMemo(() => {
    const values = dashboardCharts?.spec_line?.data?.[0]?.values || [];
    const map = new Map();
    values.forEach((v) => v.Time && map.set(v.Time, (map.get(v.Time) || 0) + (v.rawQuota || 0)));
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([time, value]) => ({ time, value }));
  }, [dashboardCharts?.spec_line]);

  const timeCallsData = useMemo(() => {
    const values = dashboardCharts?.spec_model_line?.data?.[0]?.values || [];
    const map = new Map();
    values.forEach((v) => v.Time && map.set(v.Time, (map.get(v.Time) || 0) + (v.Count || 0)));
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([time, value]) => ({ time, value }));
  }, [dashboardCharts?.spec_model_line]);

  const modelByCalls = useMemo(() => {
    const values = dashboardCharts?.spec_pie?.data?.[0]?.values || [];
    return values.filter((v) => v.type !== 'null').sort((a, b) => Number(b.value) - Number(a.value)).slice(0, 8)
      .map((v) => ({ model: v.type, count: Number(v.value) }));
  }, [dashboardCharts?.spec_pie]);

  const modelByQuota = useMemo(() => {
    const values = dashboardCharts?.spec_line?.data?.[0]?.values || [];
    const map = new Map();
    values.forEach((v) => v.Model && map.set(v.Model, (map.get(v.Model) || 0) + (v.rawQuota || 0)));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([model, count]) => ({ model, count }));
  }, [dashboardCharts?.spec_line]);

  const balance     = userState?.user?.quota;
  const usedTotal   = userState?.user?.used_quota;
  const periodQuota = dashboardData.consumeQuota;
  const periodCalls = dashboardData.times;
  const loading     = dashboardData.loading;

  const renderChart = () => {
    if (chartTab === 'quota')        return <SimpleBarChart data={timeQuotaData}  loading={loading} t={t} valueLabel='quota' />;
    if (chartTab === 'calls')        return <SimpleBarChart data={timeCallsData}  loading={loading} t={t} valueLabel='count' />;
    if (chartTab === 'models_calls') return <SimpleBarChart data={modelByCalls.map((it) => ({ time: it.model, value: it.count }))} loading={loading} t={t} valueLabel='count' />;
    if (chartTab === 'models_quota') return <SimpleBarChart data={modelByQuota.map((it) => ({ time: it.model, value: it.count }))} loading={loading} t={t} valueLabel='quota' />;
    return null;
  };

  return (
    <div className='min-h-full px-4 pt-8 pb-6 md:px-6 md:pt-10 md:pb-8' style={{ backgroundColor: 'var(--page-bg)' }}>
      <div className='max-w-[960px] mx-auto'>
        {/* Header */}
        <div className='flex items-center justify-between mb-6'>
          <h1 className='text-2xl md:text-3xl font-medium text-ui-text' style={{ letterSpacing: '-0.02em' }}>{t('概览')}</h1>
          <div className='flex items-center gap-2'>
            <Button variant='toggle' onClick={() => setSearchOpen(true)}>{t('筛选时间')}</Button>
            <IconButton icon={RefreshCw} onClick={handleRefresh} disabled={loading} title={t('刷新')} className={loading ? '[&_svg]:animate-spin' : ''} />
          </div>
        </div>

        {/* Stats */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-3 mb-4'>
          <StatCard icon={Wallet}      title={t('钱包余额')}   value={balance !== undefined ? renderQuota(balance) : '-'} sub={`${t('累计消费')}：${usedTotal !== undefined ? renderQuota(usedTotal) : '-'}`} loading={balance === undefined} />
          <StatCard icon={TrendingUp}  title={t('本周期消费')} value={periodQuota !== undefined ? renderQuota(periodQuota) : '-'} sub={`${t('调用次数')}：${renderNumber(periodCalls || 0)}`} loading={loading} />
        </div>

        {/* Chart */}
        <Card>
          <div className='mb-3'>
            <Tabs
              variant='underline'
              value={chartTab}
              onChange={setChartTab}
              items={[
                { value: 'quota',         label: t('额度消耗') },
                { value: 'calls',         label: t('调用次数') },
                { value: 'models_calls',  label: t('模型 Top（次数）') },
                { value: 'models_quota',  label: t('模型 Top（消耗）') },
              ]}
            />
          </div>
          {renderChart()}
        </Card>

        <div className='h-4' />
        <InfoSidebar statusState={statusState} t={t} />
      </div>

      <SimpleSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onConfirm={async () => {
          await dashboardData.handleSearchConfirm?.(dashboardCharts.updateChartData);
        }}
        dashboardData={dashboardData}
        t={t}
      />
    </div>
  );
};

export default Dashboard;

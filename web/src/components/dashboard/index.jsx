/*
Copyright (C) 2025 QuantumNous

BAI-inspired overview dashboard, fully integrated with backend stats.
*/

import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, RefreshCw, Wallet, TrendingUp } from 'lucide-react';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import { renderQuota, renderNumber, getRelativeTime } from '../../helpers';

import { useDashboardData } from '../../hooks/dashboard/useDashboardData';
import { useDashboardCharts } from '../../hooks/dashboard/useDashboardCharts';

import MonthlyBarChart from './parts/MonthlyBarChart';
import ModelBreakdown from './parts/ModelBreakdown';
import InfoCard from './parts/InfoCard';
import SearchModal from './parts/SearchModal';

const Dashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
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

  const initChart = async () => {
    const data = await dashboardData.loadQuotaData();
    if (data && data.length > 0) dashboardCharts.updateChartData(data);
    await dashboardData.loadUptimeData();
  };

  const handleRefresh = async () => {
    const data = await dashboardData.refresh();
    if (data && data.length > 0) dashboardCharts.updateChartData(data);
  };

  const handleSearchConfirm = async () => {
    await dashboardData.handleSearchConfirm(dashboardCharts.updateChartData);
  };

  useEffect(() => { initChart(); }, []);

  // 时间序列：按时间聚合 quota
  const timeQuotaData = useMemo(() => {
    const values = dashboardCharts?.spec_line?.data?.[0]?.values || [];
    if (values.length === 0) return [];
    const map = new Map();
    values.forEach((v) => {
      const time = v.Time;
      if (!time) return;
      map.set(time, (map.get(time) || 0) + (v.rawQuota || 0));
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([time, value]) => ({ time, value }));
  }, [dashboardCharts?.spec_line]);

  // 时间序列：按时间聚合 调用次数
  const timeCallsData = useMemo(() => {
    const values = dashboardCharts?.spec_model_line?.data?.[0]?.values || [];
    if (values.length === 0) return [];
    const map = new Map();
    values.forEach((v) => {
      const time = v.Time;
      if (!time) return;
      map.set(time, (map.get(time) || 0) + (v.Count || 0));
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([time, value]) => ({ time, value }));
  }, [dashboardCharts?.spec_model_line]);

  // 模型 Top（按调用次数）
  const modelByCalls = useMemo(() => {
    const values = dashboardCharts?.spec_pie?.data?.[0]?.values || [];
    return values
      .filter((v) => v.type !== 'null')
      .sort((a, b) => Number(b.value) - Number(a.value))
      .slice(0, 8)
      .map((v) => ({
        model: v.type,
        count: Number(v.value),
        color: dashboardCharts?.spec_pie?.color?.specified?.[v.type],
      }));
  }, [dashboardCharts?.spec_pie]);

  // 模型 Top（按消耗 quota）
  const modelByQuota = useMemo(() => {
    const values = dashboardCharts?.spec_line?.data?.[0]?.values || [];
    if (values.length === 0) return [];
    const map = new Map();
    values.forEach((v) => {
      if (!v.Model) return;
      map.set(v.Model, (map.get(v.Model) || 0) + (v.rawQuota || 0));
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([model, count]) => ({
        model,
        count,
        color: dashboardCharts?.spec_pie?.color?.specified?.[model],
      }));
  }, [dashboardCharts?.spec_line, dashboardCharts?.spec_pie]);

  const performanceMetrics = dashboardData.performanceMetrics || { avgRPM: 0, avgTPM: 0 };

  const balance = userState?.user?.quota;
  const usedTotal = userState?.user?.used_quota;
  const requestCount = userState?.user?.request_count;
  const periodQuota = dashboardData.consumeQuota;
  const periodCalls = dashboardData.times;
  const periodTokens = dashboardData.consumeTokens;
  const loading = dashboardData.loading;

  // 公告数据：补上 time / relative
  const announcementData = useMemo(() => {
    return (statusState?.status?.announcements || []).map((item) => {
      const pubDate = item?.publishDate ? new Date(item.publishDate) : null;
      const time = pubDate && !isNaN(pubDate.getTime())
        ? `${pubDate.getFullYear()}-${String(pubDate.getMonth() + 1).padStart(2, '0')}-${String(pubDate.getDate()).padStart(2, '0')}`
        : item?.publishDate || '';
      return { ...item, time, relative: getRelativeTime(item.publishDate) };
    });
  }, [statusState?.status?.announcements]);

  const apiInfoData = statusState?.status?.api_info || [];
  const faqData = statusState?.status?.faq || [];

  // 图表 tab 配置
  const chartTabs = [
    { key: 'quota', label: t('额度消耗') },
    { key: 'calls', label: t('调用次数') },
    { key: 'models_calls', label: t('模型 Top（次数）') },
    { key: 'models_quota', label: t('模型 Top（消耗）') },
  ];

  const renderChartContent = () => {
    if (chartTab === 'quota') return <MonthlyBarChart data={timeQuotaData} loading={loading} t={t} valueLabel='quota' />;
    if (chartTab === 'calls') return <MonthlyBarChart data={timeCallsData} loading={loading} t={t} valueLabel='count' />;
    if (chartTab === 'models_calls') return <ModelBreakdown items={modelByCalls} loading={loading} t={t} />;
    if (chartTab === 'models_quota') return <ModelBreakdown items={modelByQuota} loading={loading} t={t} valueType='quota' />;
    return null;
  };

  return (
    <div className='min-h-full px-4 pt-8 pb-6 md:px-6 md:pt-10 md:pb-8'>
      <div className='max-w-[960px] mx-auto'>
        {/* Header */}
        <div className='flex items-center justify-between mb-6'>
        <h1
          className='text-2xl md:text-3xl font-medium text-ui-text'
          style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}
        >
          {t('概览')}
        </h1>
        <div className='flex items-center gap-2'>
          <button
            onClick={dashboardData.showSearchModal}
            className='inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors'
          >
            {t('筛选时间')}
          </button>
          <button
            onClick={handleRefresh}
            disabled={loading}
            title={t('刷新')}
            className='inline-flex items-center justify-center w-10 h-10 rounded-xl text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle border border-ui-border transition-colors disabled:opacity-50'
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <SearchModal
        searchModalVisible={dashboardData.searchModalVisible}
        handleSearchConfirm={handleSearchConfirm}
        handleCloseModal={dashboardData.handleCloseModal}
        isMobile={dashboardData.isMobile}
        isAdminUser={dashboardData.isAdminUser}
        inputs={dashboardData.inputs}
        dataExportDefaultTime={dashboardData.dataExportDefaultTime}
        timeOptions={dashboardData.timeOptions}
        handleInputChange={dashboardData.handleInputChange}
        t={t}
      />

      {/* 用量 — 2 张卡片 */}
      <SectionLabel>{t('用量')}</SectionLabel>
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 mb-8'>
        {/* 账户 */}
        <div
          className='relative border border-ui-border rounded-2xl p-5'
          style={{ backgroundColor: 'var(--page-bg)' }}
        >
          <div className='flex items-center justify-between mb-1'>
            <div className='flex items-center gap-2 text-[13px] text-ui-text-2'>
              <Wallet size={16} className='text-ui-text-3' />
              <span>{t('当前余额')}</span>
            </div>
            <button
              onClick={() => navigate('/console/topup')}
              className='inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover transition-colors'
            >
              <Plus size={11} />
              {t('充值')}
            </button>
          </div>
          <div
            className='mt-2 text-[34px] font-semibold text-ui-text leading-none tabular-nums'
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}
          >
            {loading ? '…' : renderQuota(balance)}
          </div>
          <div className='mt-5 pt-4 border-t border-ui-divider grid grid-cols-2 gap-3'>
            <SubStat label={t('历史消耗')} value={loading ? '…' : renderQuota(usedTotal)} />
            <SubStat label={t('累计调用')} value={loading ? '…' : renderNumber(requestCount || 0)} />
          </div>
        </div>

        {/* 当前周期 */}
        <div
          className='border border-ui-border rounded-2xl p-5'
          style={{ backgroundColor: 'var(--page-bg)' }}
        >
          <div className='flex items-center gap-2 text-[13px] text-ui-text-2 mb-1'>
            <TrendingUp size={16} className='text-ui-text-3' />
            <span>{t('当前周期消耗')}</span>
          </div>
          <div
            className='mt-2 text-[34px] font-semibold text-ui-text leading-none tabular-nums'
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}
          >
            {loading ? '…' : renderQuota(periodQuota)}
          </div>
          <div className='mt-5 pt-4 border-t border-ui-divider grid grid-cols-2 sm:grid-cols-4 gap-3'>
            <SubStat
              label={t('调用次数')}
              value={loading ? '…' : renderNumber(periodCalls || 0)}
            />
            <SubStat
              label={t('Tokens')}
              value={loading ? '…' : renderNumber(safeNum(periodTokens))}
            />
            <SubStat label={t('平均 RPM')} value={loading ? '…' : (performanceMetrics?.avgRPM ?? 0)} />
            <SubStat label={t('平均 TPM')} value={loading ? '…' : (performanceMetrics?.avgTPM ?? 0)} />
          </div>
        </div>
      </div>

      {/* 图表区 — 独占一行 */}
      <div className='mb-8'>
        <div className='flex items-center justify-between mb-3 gap-3'>
          <span className='text-[11px] font-semibold uppercase tracking-widest text-ui-text-3 flex-shrink-0'>
            {t('数据分析')}
          </span>
          <div className='flex items-center gap-0.5 overflow-x-auto scrollbar-hide -mx-1 px-1'>
            {chartTabs.map((tb) => (
              <button
                key={tb.key}
                onClick={() => setChartTab(tb.key)}
                className={`px-2.5 py-1 text-[11px] rounded-md transition-colors whitespace-nowrap flex-shrink-0 ${
                  chartTab === tb.key
                    ? 'bg-ui-bg-subtle text-ui-text font-medium'
                    : 'text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle'
                }`}
              >
                {tb.label}
              </button>
            ))}
          </div>
        </div>
        <div
          className='border border-ui-border rounded-2xl p-5'
          style={{ backgroundColor: 'var(--page-bg)' }}
        >
          {renderChartContent()}
        </div>
      </div>

      {/* 信息区 — 独占一行 */}
      <div className='mb-8'>
        <InfoCard
          apiInfoEnabled={dashboardData.apiInfoEnabled}
          announcementsEnabled={dashboardData.announcementsEnabled}
          faqEnabled={dashboardData.faqEnabled}
          uptimeEnabled={dashboardData.uptimeEnabled}
          apiInfoData={apiInfoData}
          announcementData={announcementData}
          faqData={faqData}
          uptimeData={dashboardData.uptimeData}
          uptimeLoading={dashboardData.uptimeLoading}
          loading={loading}
          activeUptimeTab={dashboardData.activeUptimeTab}
          setActiveUptimeTab={dashboardData.setActiveUptimeTab}
          t={t}
        />
      </div>
      </div>
    </div>
  );
};

const SectionLabel = ({ children }) => (
  <div className='text-[11px] font-semibold uppercase tracking-widest text-ui-text-3 mb-3'>
    {children}
  </div>
);

const SubStat = ({ label, value }) => (
  <div className='min-w-0'>
    <div className='text-[11px] uppercase tracking-wider text-ui-text-3 mb-1 truncate'>
      {label}
    </div>
    <div
      className='text-[15px] font-semibold text-ui-text tabular-nums truncate'
      style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.01em' }}
    >
      {value}
    </div>
  </div>
);

const safeNum = (v) => (typeof v === 'number' && !isNaN(v) ? v : 0);

export default Dashboard;

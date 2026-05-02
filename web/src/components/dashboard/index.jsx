/*
Copyright (C) 2025 QuantumNous

Modern minimalist dashboard, fully decoupled from semi-ui visuals.
*/

import React, { useContext, useEffect } from 'react';
import { getRelativeTime } from '../../helpers';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';

import { useDashboardData } from '../../hooks/dashboard/useDashboardData';
import { useDashboardStats } from '../../hooks/dashboard/useDashboardStats';
import { useDashboardCharts } from '../../hooks/dashboard/useDashboardCharts';

import Header from './parts/Header';
import KPICard from './parts/KPICard';
import ChartsCard from './parts/ChartsCard';
import InfoCard from './parts/InfoCard';
import SearchModal from './parts/SearchModal';

const Dashboard = () => {
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState, statusDispatch] = useContext(StatusContext);

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
    dashboardData.t,
  );
  const { groupedStatsData } = useDashboardStats(
    userState,
    dashboardData.consumeQuota,
    dashboardData.consumeTokens,
    dashboardData.times,
    dashboardData.trendData,
    dashboardData.performanceMetrics,
    dashboardData.navigate,
    dashboardData.t,
  );

  // ── data orchestration ──
  const loadUserData = async () => {
    if (dashboardData.isAdminUser) {
      const userData = await dashboardData.loadUserQuotaData();
      if (userData && userData.length > 0) {
        dashboardCharts.updateUserChartData(userData);
      }
    }
  };

  const initChart = async () => {
    await dashboardData.loadQuotaData().then((data) => {
      if (data && data.length > 0) dashboardCharts.updateChartData(data);
    });
    await loadUserData();
    await dashboardData.loadUptimeData();
  };

  const handleRefresh = async () => {
    const data = await dashboardData.refresh();
    if (data && data.length > 0) dashboardCharts.updateChartData(data);
    await loadUserData();
  };

  const handleSearchConfirm = async () => {
    await dashboardData.handleSearchConfirm(dashboardCharts.updateChartData);
    await loadUserData();
  };

  useEffect(() => {
    initChart();
  }, []);

  // ── flatten 4 groups × 2 items = 8 KPI cards ──
  const kpiItems = (groupedStatsData || []).flatMap((g) => g.items || []);

  // ── prepare info data ──
  const apiInfoData = statusState?.status?.api_info || [];
  const announcementData = (statusState?.status?.announcements || []).map((item) => {
    const pubDate = item?.publishDate ? new Date(item.publishDate) : null;
    const time =
      pubDate && !isNaN(pubDate.getTime())
        ? `${pubDate.getFullYear()}-${String(pubDate.getMonth() + 1).padStart(2, '0')}-${String(pubDate.getDate()).padStart(2, '0')}`
        : item?.publishDate || '';
    return { ...item, time, relative: getRelativeTime(item.publishDate) };
  });
  const faqData = statusState?.status?.faq || [];

  const t = dashboardData.t;
  const navigate = dashboardData.navigate;

  return (
    <div className='min-h-full px-4 py-5 md:px-6 md:py-6 bg-ui-bg'>
      <Header
        greeting={dashboardData.getGreeting}
        greetingVisible={dashboardData.greetingVisible}
        onSearch={dashboardData.showSearchModal}
        onRefresh={handleRefresh}
        loading={dashboardData.loading}
        t={t}
      />

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

      {/* KPI grid: 8 single cards */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6'>
        {kpiItems.map((item, i) => (
          <KPICard
            key={i}
            label={item.title}
            value={item.value}
            trendData={item.trendData}
            trendColor={item.trendColor}
            loading={dashboardData.loading}
            onClick={item.onClick}
            action={
              item.title === t('当前余额') ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/console/topup');
                  }}
                  className='text-[11px] font-medium text-ui-brand hover:underline'
                >
                  {t('充值')}
                </button>
              ) : null
            }
          />
        ))}
      </div>

      {/* main grid: charts (8) + info (4) */}
      <div className='grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6'>
        <div className='lg:col-span-8'>
          <ChartsCard
            activeChartTab={dashboardData.activeChartTab}
            setActiveChartTab={dashboardData.setActiveChartTab}
            spec_line={dashboardCharts.spec_line}
            spec_model_line={dashboardCharts.spec_model_line}
            spec_pie={dashboardCharts.spec_pie}
            spec_rank_bar={dashboardCharts.spec_rank_bar}
            spec_user_rank={dashboardCharts.spec_user_rank}
            spec_user_trend={dashboardCharts.spec_user_trend}
            isAdminUser={dashboardData.isAdminUser}
            t={t}
          />
        </div>
        <div className='lg:col-span-4'>
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
            activeUptimeTab={dashboardData.activeUptimeTab}
            setActiveUptimeTab={dashboardData.setActiveUptimeTab}
            t={t}
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

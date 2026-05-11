/*
 * useDashboardCharts — 简化版（移除 @visactor 依赖）
 */
import { useState, useCallback } from 'react';

export const useDashboardCharts = (
  dataExportDefaultTime,
  setTrendData,
  setConsumeQuota,
  setTimes,
  setConsumeTokens,
  setPieData,
  setLineData,
  setModelColors,
) => {
  const [specLine, setSpecLine] = useState({ data: [{ values: [] }] });
  const [specModelLine, setSpecModelLine] = useState({ data: [{ values: [] }] });
  const [specPie, setSpecPie] = useState({ data: [{ values: [] }], color: { specified: {} } });

  const updateChartData = useCallback((rawData) => {
    if (!rawData?.length) return;
    const lineValues = rawData.map((it) => ({
      Time: it.day || it.date || it.time || '',
      Model: it.model_name || it.model || '',
      rawQuota: Number(it.quota || 0),
    }));
    setSpecLine({ data: [{ values: lineValues }] });
    const modelLineValues = rawData.map((it) => ({
      Time: it.day || it.date || it.time || '',
      Model: it.model_name || it.model || '',
      Count: Number(it.count || it.request_count || 0),
    }));
    setSpecModelLine({ data: [{ values: modelLineValues }] });
    const modelCount = new Map();
    rawData.forEach((it) => {
      const m = it.model_name || it.model || 'unknown';
      modelCount.set(m, (modelCount.get(m) || 0) + Number(it.count || it.request_count || 0));
    });
    setSpecPie({
      data: [{ values: Array.from(modelCount.entries()).map(([type, value]) => ({ type, value })) }],
      color: { specified: {} },
    });
    const totalQuota = rawData.reduce((acc, it) => acc + Number(it.quota || 0), 0);
    const totalCalls = rawData.reduce((acc, it) => acc + Number(it.count || it.request_count || 0), 0);
    const totalTokens = rawData.reduce((acc, it) => acc + Number(it.token_used || it.tokens || 0), 0);
    setConsumeQuota?.(totalQuota); setTimes?.(totalCalls); setConsumeTokens?.(totalTokens);
    setTrendData?.([]); setLineData?.([]); setPieData?.([]); setModelColors?.({});
  }, [setConsumeQuota, setTimes, setConsumeTokens, setTrendData, setLineData, setPieData, setModelColors]);

  return { updateChartData, spec_line: specLine, spec_model_line: specModelLine, spec_pie: specPie };
};

export default useDashboardCharts;

/*
 * Top models — render as a bar chart for visual consistency with other tabs.
 */
import React from 'react';
import MonthlyBarChart from './MonthlyBarChart';

const ModelBreakdown = ({ items = [], loading, t, valueType }) => {
  const data = (items || []).map((it) => ({
    time: it.model,
    value: it.count || 0,
  }));

  return (
    <MonthlyBarChart
      data={data}
      loading={loading}
      t={t}
      valueLabel={valueType === 'quota' ? 'quota' : 'count'}
    />
  );
};

export default ModelBreakdown;

import React, { useEffect, useState } from 'react';
import { API } from '../../helpers';
import { Loading } from '../../components/ui';
import { UPTIME_STATUS_MAP } from '../../constants/dashboard.constants';

const StatusPage = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await API.get('/api/uptime/status');
        if (res.data?.success) setData(res.data.data || []);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><Loading /></div>;

  const groups = data.map((g) => {
    const monitors = g.monitors || g.monitorList || [];
    const allUp = monitors.every((m) => m.status === 1);
    const avgUptime = monitors.length > 0 ? monitors.reduce((s, m) => s + (m.uptime || 0), 0) / monitors.length : 0;
    const beats = monitors.length > 0 ? (monitors[0].heartbeats || []).map((hb, i) => {
      const worst = monitors.reduce((s, m) => {
        const mhb = (m.heartbeats || [])[i];
        if (!mhb || mhb.status === 0) return 0;
        if (mhb.status === 2 && s !== 0) return 2;
        return s;
      }, hb.status);
      return { ...hb, status: worst };
    }) : [];
    return { name: g.categoryName, status: allUp ? 1 : 0, uptime: avgUptime, heartbeats: beats, monitorCount: monitors.length };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, width: '100%', maxWidth: 740, marginInline: 'auto', padding: '24px 16px', minHeight: 'calc(100vh - 64px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: '#000' }}>服务状态</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {groups.map((g, i) => {
          const statusInfo = UPTIME_STATUS_MAP[g.status] || {};
          const color = statusInfo.color || '#999';
          const pct = ((g.uptime || 0) * 100).toFixed(2);
          const beats = g.heartbeats || [];
          return (
            <div key={i} style={{ padding: '20px 22px', border: '1px solid #e9e9e9', borderRadius: 26 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 15, fontWeight: 500, color: '#000' }}>{g.name}</span>
                </div>
                <span style={{ fontSize: 13, color: '#666', fontVariantNumeric: 'tabular-nums' }}>{pct}% uptime</span>
              </div>
              {beats.length > 0 && (
                <div style={{ display: 'flex', gap: 2, height: 36, alignItems: 'stretch' }}>
                  {beats.map((hb, j) => {
                    const hbColor = (UPTIME_STATUS_MAP[hb.status] || {}).color || '#d1d5db';
                    return (
                      <div
                        key={j}
                        title={`${hb.time} - ${hb.ping}ms`}
                        style={{ flex: 1, borderRadius: 3, background: hbColor, cursor: 'default' }}
                      />
                    );
                  })}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ fontSize: 11, color: '#999' }}>50 分钟前</span>
                <span style={{ fontSize: 11, color: '#999' }}>现在</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StatusPage;

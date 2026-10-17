import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { API, showError, renderQuota } from '../../helpers';
import { Tag, IconButton, Loading } from '../../components/ui';
import useIsMobile from '../../hooks/useIsMobile';

const MySubscription = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/subscription/self');
      if (res.data?.success) setData(res.data.data);
    } catch (e) { showError(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><Loading /></div>;

  const allSubs = data?.all_subscriptions || [];
  const activeSub = allSubs.find((r) => {
    const s = r.subscription || {};
    const expired = (s.end_time || 0) > 0 && s.end_time < Date.now() / 1000;
    return s.status === 'active' && !expired;
  });
  const inactiveSubs = allSubs.filter((r) => {
    const s = r.subscription || {};
    const expired = (s.end_time || 0) > 0 && s.end_time < Date.now() / 1000;
    return !(s.status === 'active' && !expired);
  });

  const formatDate = (ts) => {
    if (!ts) return '-';
    const d = new Date(ts * 1000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const parseList = (str) => {
    if (!str) return [];
    try { return JSON.parse(str); } catch { return []; }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 20 : 28, width: '100%', maxWidth: 960, marginInline: 'auto', padding: isMobile ? '16px' : '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ui-text)' }}>我的订阅</h1>
        <IconButton icon={RefreshCw} title='刷新' onClick={load} />
      </div>

      {!activeSub && allSubs.length === 0 ? (
        <EmptyState navigate={navigate} isMobile={isMobile} />
      ) : (
        <>
          {activeSub ? (
            <ActiveSection row={activeSub} isMobile={isMobile} formatDate={formatDate} parseList={parseList} />
          ) : (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ui-text-3)', fontSize: 14 }}>
              当前无生效中的订阅
            </div>
          )}

          {inactiveSubs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ui-text-2)' }}>历史订阅</span>
              {inactiveSubs.map((row) => (
                <HistoryItem key={row.subscription?.id} row={row} formatDate={formatDate} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const EmptyState = ({ navigate, isMobile }) => (
  <div style={{ padding: isMobile ? '32px 0' : '48px 16px', textAlign: 'center' }}>
    <div style={{ fontSize: 14, color: 'var(--ui-text-3)', marginBottom: 16 }}>暂无订阅，可通过兑换码激活</div>
    <button
      onClick={() => navigate('/console/topup')}
      style={{
        cursor: 'pointer', height: 36, paddingInline: 20, border: '1px solid var(--ui-text)',
        borderRadius: 24, fontSize: 14, color: 'var(--ui-text)', background: 'transparent',
      }}
    >前往充值页兑换</button>
  </div>
);

const ActiveSection = ({ row, isMobile, formatDate, parseList }) => {
  const s = row.subscription || {};
  const usedPct = s.amount_total > 0 ? Math.min(100, (s.amount_used / s.amount_total) * 100) : 0;
  const models = parseList(s.allowed_models);
  const groups = parseList(s.allowed_groups);

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--ui-text)' }}>套餐 #{s.plan_id}</span>
          <Tag color='green'>生效中</Tag>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <InfoItem label='有效期' value={`${formatDate(s.start_time)} ~ ${s.end_time ? formatDate(s.end_time) : '永久'}`} />
          <InfoItem label='来源' value={s.source === 'admin' ? '管理员分配' : '兑换码激活'} />

          <div>
            <div style={{ fontSize: 13, color: 'var(--ui-text-3)', marginBottom: 6 }}>额度用量</div>
            {s.amount_total > 0 ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
                  <span style={{ color: 'var(--ui-text-2)' }}>已用 {renderQuota(s.amount_used || 0)}</span>
                  <span style={{ color: 'var(--ui-text-3)' }}>/ {renderQuota(s.amount_total)}</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--ui-bg-subtle)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, width: `${usedPct}%`, background: usedPct > 80 ? 'var(--ui-danger)' : 'var(--ui-accent)', transition: 'width 0.3s' }} />
                </div>
              </>
            ) : (
              <span style={{ fontSize: 15, color: 'var(--ui-text)' }}>无限制</span>
            )}
          </div>

          <InfoItem label='并发/RPM' value={
            (s.concurrent_limit || s.rpm_limit)
              ? `${s.concurrent_limit || '∞'} 并发 / ${s.rpm_limit || '∞'} RPM`
              : '无限制'
          } />
        </div>

        {(models.length > 0 || groups.length > 0) && (
          <div style={{ paddingTop: 14, borderTop: '1px solid var(--ui-divider)' }}>
            {groups.length > 0 && (
              <div style={{ marginBottom: models.length > 0 ? 10 : 0 }}>
                <div style={{ fontSize: 13, color: 'var(--ui-text-3)', marginBottom: 6 }}>可用分组</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {groups.map((g) => <Tag key={g} color='blue'>{g}</Tag>)}
                </div>
              </div>
            )}
            {models.length > 0 && (
              <div>
                <div style={{ fontSize: 13, color: 'var(--ui-text-3)', marginBottom: 6 }}>可用模型</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {models.map((m) => <Tag key={m} color='grey'>{m}</Tag>)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ border: '1px solid var(--ui-border)', borderRadius: 26, padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--ui-text)' }}>套餐 #{s.plan_id}</span>
          <Tag color='green'>生效中</Tag>
        </div>
        <span style={{ fontSize: 13, color: 'var(--ui-text-3)' }}>ID: {s.id}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <InfoItem label='有效期' value={`${formatDate(s.start_time)} ~ ${s.end_time ? formatDate(s.end_time) : '永久'}`} />
        <InfoItem label='来源' value={s.source === 'admin' ? '管理员分配' : '兑换码激活'} />

        <div>
          <div style={{ fontSize: 13, color: 'var(--ui-text-3)', marginBottom: 6 }}>额度用量</div>
          {s.amount_total > 0 ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
                <span style={{ color: 'var(--ui-text-2)' }}>已用 {renderQuota(s.amount_used || 0)}</span>
                <span style={{ color: 'var(--ui-text-3)' }}>/ {renderQuota(s.amount_total)}</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--ui-bg-subtle)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 3, width: `${usedPct}%`, background: usedPct > 80 ? 'var(--ui-danger)' : 'var(--ui-accent)', transition: 'width 0.3s' }} />
              </div>
            </>
          ) : (
            <span style={{ fontSize: 15, color: 'var(--ui-text)' }}>无限制</span>
          )}
        </div>

        <InfoItem label='并发/RPM 限制' value={
          (s.concurrent_limit || s.rpm_limit)
            ? `${s.concurrent_limit || '∞'} 并发 / ${s.rpm_limit || '∞'} RPM`
            : '无限制'
        } />
      </div>

      {(models.length > 0 || groups.length > 0) && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--ui-divider)' }}>
          {groups.length > 0 && (
            <div style={{ marginBottom: models.length > 0 ? 10 : 0 }}>
              <div style={{ fontSize: 13, color: 'var(--ui-text-3)', marginBottom: 6 }}>可用分组</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {groups.map((g) => <Tag key={g} color='blue'>{g}</Tag>)}
              </div>
            </div>
          )}
          {models.length > 0 && (
            <div>
              <div style={{ fontSize: 13, color: 'var(--ui-text-3)', marginBottom: 6 }}>可用模型</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {models.map((m) => <Tag key={m} color='grey'>{m}</Tag>)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const HistoryItem = ({ row, formatDate }) => {
  const s = row.subscription || {};
  const expired = (s.end_time || 0) > 0 && s.end_time < Date.now() / 1000;
  const statusText = expired ? '已过期' : '已取消';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px', border: '1px solid var(--ui-border)', borderRadius: 16, opacity: 0.6,
    }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--ui-text)' }}>套餐 #{s.plan_id}</div>
        <div style={{ fontSize: 13, color: 'var(--ui-text-3)', marginTop: 2 }}>
          {formatDate(s.start_time)} ~ {formatDate(s.end_time)}
        </div>
      </div>
      <Tag color={expired ? 'red' : 'grey'}>{statusText}</Tag>
    </div>
  );
};

const InfoItem = ({ label, value }) => (
  <div>
    <div style={{ fontSize: 13, color: 'var(--ui-text-3)', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 15, color: 'var(--ui-text)' }}>{value}</div>
  </div>
);

export default MySubscription;

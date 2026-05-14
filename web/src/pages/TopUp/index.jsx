import React, { useContext, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Copy } from 'lucide-react';
import { API, showError, showSuccess, showInfo, copy, renderQuota, timestamp2string } from '../../helpers';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import {
  Button, IconButton, Input, NumberInput, Modal, Loading,
} from '../../components/ui';
import useIsMobile from '../../hooks/useIsMobile';

const TopUp = () => {
  const [searchParams] = useSearchParams();
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);
  const isMobile = useIsMobile();

  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [topUpCount, setTopUpCount] = useState(statusState?.status?.min_topup || 10);
  const [affLink, setAffLink] = useState('');
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferAmount, setTransferAmount] = useState(0);
  const [transferring, setTransferring] = useState(false);
  const [topups, setTopups] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const minTopUp = statusState?.status?.min_topup || 1;
  const topUpLink = statusState?.status?.top_up_link || '';

  const refreshUser = async () => {
    try {
      const { data } = await API.get('/api/user/self');
      if (data.success) userDispatch?.({ type: 'login', payload: data.data });
    } catch (e) { showError(e); }
  };

  const loadAff = async () => {
    try {
      const { data } = await API.get('/api/user/aff');
      if (data.success) {
        const base = statusState?.status?.server_address || window.location.origin;
        setAffLink(`${base}/register?aff=${data.data}`);
      }
    } catch {}
  };

  const loadTopups = async () => {
    try {
      const res = await API.get('/api/log/self/?p=1&size=20&type=1&token_name=&model_name=&group=&request_id=&start_timestamp=0&end_timestamp=0');
      if (res.data?.success) setTopups(res.data.data?.items || []);
    } catch {}
  };

  useEffect(() => {
    refreshUser(); loadAff();
    const c = searchParams.get('code');
    if (c) setCode(c);
  }, []);

  const redeem = async () => {
    const key = code.trim();
    if (!key) return showInfo('请输入兑换码');
    setRedeeming(true);
    try {
      try {
        const sub = await API.post('/api/subscription/redeem', { key }, { skipErrorHandler: true });
        if (sub.data?.success) {
          showSuccess('已激活订阅：' + (sub.data.data?.plan_title || ''));
          setCode(''); refreshUser();
          return;
        }
        if (sub.data?.message && !/无效的兑换码|invalid/i.test(sub.data.message)) {
          showError(sub.data.message);
          return;
        }
      } catch {}
      const { data } = await API.post('/api/user/topup', { key });
      if (data.success) {
        showSuccess('兑换成功！获得 ' + renderQuota(data.data));
        setCode(''); refreshUser();
      } else showError(data.message);
    } catch (e) { showError(e); } finally { setRedeeming(false); }
  };

  const transferAff = async () => {
    if (!transferAmount || transferAmount <= 0) return showError('请输入有效金额');
    setTransferring(true);
    try {
      const { data } = await API.post('/api/user/aff_transfer', { quota: transferAmount });
      if (data.success) { showSuccess('划转成功'); setTransferOpen(false); setTransferAmount(0); refreshUser(); }
      else showError(data.message);
    } catch (e) { showError(e); } finally { setTransferring(false); }
  };

  const u = userState?.user || {};
  const AMOUNTS = [10, 50, 100, 500];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 20 : 28, width: '100%', maxWidth: 960, marginInline: 'auto', padding: isMobile ? '16px' : '24px 16px' }}>
      {/* 余额 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBlock: 26, paddingInline: 20, border: '1px solid var(--ui-border)', borderRadius: 26 }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--ui-text-3)', marginBottom: 6 }}>当前余额</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--ui-text)' }}>{renderQuota(u.quota || 0)}</div>
          <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginTop: 4 }}>累计已使用 {renderQuota(u.used_quota || 0)}</div>
        </div>
        <button
          onClick={() => { setShowHistory(true); loadTopups(); }}
          style={{ cursor: 'pointer', height: 32, paddingInline: 16, border: '1px solid var(--ui-border)', borderRadius: 24, fontSize: 13, color: 'var(--ui-text-2)', background: 'transparent' }}
        >充值记录</button>
      </div>

      {/* 兑换码 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--ui-text)' }}>兑换码</span>
        <div style={{ fontSize: 14, color: 'var(--ui-text-3)' }}>输入兑换码，立即获得对应额度或激活订阅</div>
        <div style={{ display: 'flex', gap: 8, maxWidth: 420 }}>
          <Input
            value={code}
            onChange={setCode}
            onKeyDown={(e) => e.key === 'Enter' && redeem()}
            placeholder='XXXX-XXXX-XXXX-XXXX'
            width='full'
            className='font-mono'
          />
          <Button onClick={redeem} loading={redeeming} disabled={!code.trim()}>兑换</Button>
        </div>
      </div>

      {/* 快捷充值 */}
      {topUpLink && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--ui-text)' }}>快捷充值</span>
          {/* 金额选择 */}
          <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 8 }}>
            {AMOUNTS.map((amt) => (
              <button
                key={amt}
                onClick={() => setTopUpCount(amt)}
                style={{
                  cursor: 'pointer', flex: 1, height: 45, border: topUpCount === amt ? '2px solid #000' : '1px solid #e5e5e5',
                  borderRadius: 10, fontSize: 16, fontWeight: topUpCount === amt ? 600 : 400,
                  color: 'var(--ui-text)', background: 'var(--page-bg)',
                  boxShadow: topUpCount === amt ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
              >${amt}</button>
            ))}
          </div>
          {/* 支付摘要 */}
          <div style={{ border: '1px solid var(--ui-border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 18px' }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--ui-text-3)', marginBottom: 6 }}>支付总计</div>
                <div style={{ fontSize: 28, fontWeight: 400, color: 'var(--ui-text)' }}>${topUpCount}</div>
              </div>
              <div style={{ padding: '2px 10px', border: '1px solid var(--ui-border)', borderRadius: 10, fontSize: 12, fontWeight: 500, color: 'rgba(0,0,0,0.3)', background: 'var(--ui-bg-subtle)' }}>
                $1=1,000,000
              </div>
            </div>
          </div>
          {/* 结账按钮 */}
          <button
            onClick={() => window.open(topUpLink, '_blank')}
            style={{
              cursor: 'pointer', width: '100%', height: 48, border: 'none', borderRadius: 999,
              fontSize: 16, fontWeight: 600, color: 'var(--ui-accent-fg)', background: 'var(--ui-accent)',
            }}
          >前往结账</button>
        </div>
      )}

      {/* 邀请奖励 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--ui-text)' }}>邀请奖励</span>
          {(u.aff_quota || 0) > 0 && (
            <button
              onClick={() => setTransferOpen(true)}
              style={{
                cursor: 'pointer', height: 32, paddingInline: 16, border: '1px solid var(--ui-text)', borderRadius: 24,
                fontSize: 14, color: 'var(--ui-text)', background: 'var(--page-bg)', transition: 'background 0.2s, color 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ui-accent)'; e.currentTarget.style.color = 'var(--ui-accent-fg)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--page-bg)'; e.currentTarget.style.color = 'var(--ui-text)'; }}
            >划转到余额</button>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 12 }}>
          <div style={{ padding: '16px 18px', border: '1px solid var(--ui-border)', borderRadius: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 6 }}>邀请人数</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--ui-text)' }}>{u.aff_count || 0}</div>
          </div>
          <div style={{ padding: '16px 18px', border: '1px solid var(--ui-border)', borderRadius: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 6 }}>可用奖励</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--ui-text)' }}>{renderQuota(u.aff_quota || 0)}</div>
          </div>
          <div style={{ padding: '16px 18px', border: '1px solid var(--ui-border)', borderRadius: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 6 }}>累计奖励</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--ui-text)' }}>{renderQuota(u.aff_history_quota || 0)}</div>
          </div>
        </div>
        {affLink && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', border: '1px solid var(--ui-border)', borderRadius: 26 }}>
            <span style={{ flex: 1, fontSize: 13, fontFamily: "'Gilroy', sans-serif", fontWeight: 500, color: 'var(--ui-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>{affLink}</span>
            <IconButton icon={Copy} onClick={async () => { await copy(affLink); showSuccess('已复制邀请链接'); }} />
          </div>
        )}
      </div>

      {/* 充值记录弹窗 */}
      {showHistory && (
        <Modal open title='充值记录' onClose={() => setShowHistory(false)} width={560}>
          <div style={{ overflow: 'auto', maxHeight: 400 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--ui-divider)' }}>
                  <th style={{ padding: '0 12px', textAlign: 'left', height: 32, fontWeight: 400, color: 'var(--ui-text-3)' }}>时间</th>
                  <th style={{ padding: '0 12px', textAlign: 'left', height: 32, fontWeight: 400, color: 'var(--ui-text-3)' }}>描述</th>
                  <th style={{ padding: '0 12px', textAlign: 'right', height: 32, fontWeight: 400, color: 'var(--ui-text-3)' }}>额度</th>
                </tr>
              </thead>
              <tbody>
                {topups.length === 0 ? (
                  <tr><td colSpan={3} style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--ui-text-3)' }}>暂无充值记录</td></tr>
                ) : topups.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--ui-divider)' }}>
                    <td style={{ padding: '0 12px', lineHeight: '36px', color: 'var(--ui-text)', whiteSpace: 'nowrap' }}>{t.created_at ? timestamp2string(t.created_at) : '-'}</td>
                    <td style={{ padding: '0 12px', lineHeight: '36px', color: 'var(--ui-text)' }}>{t.content || '-'}</td>
                    <td style={{ padding: '0 12px', lineHeight: '36px', color: 'var(--ui-text)', textAlign: 'right' }}>{renderQuota(t.quota || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {/* 划转弹窗 */}
      {transferOpen && (
        <Modal
          open
          title='划转邀请额度到余额'
          onClose={() => setTransferOpen(false)}
          onConfirm={transferAff}
          loading={transferring}
          confirmText='确认划转'
        >
          <div className='space-y-3'>
            <div>
              <label className='block text-sm text-[#666] mb-1.5'>划转额度</label>
              <NumberInput value={transferAmount} onChange={(v) => setTransferAmount(Number(v) || 0)} min={0} max={u.aff_quota || 0} />
              <p className='mt-1 text-xs text-[#999]'>可划转：{renderQuota(u.aff_quota || 0)}</p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default TopUp;

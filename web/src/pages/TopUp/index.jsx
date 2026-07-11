import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Copy, RefreshCw } from 'lucide-react';
import { QRCode } from 'antd';
import { API, showError, showSuccess, showInfo, copy, renderQuota, timestamp2string } from '../../helpers';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import {
  Button, IconButton, Input, Modal, Loading,
} from '../../components/ui';
import useIsMobile from '../../hooks/useIsMobile';

const PAYMENT_ICON_CDN = {
  alipay: 'https://cdn.simpleicons.org/alipay/1677FF',
  wxpay: 'https://cdn.simpleicons.org/wechat/07C160',
  wechat: 'https://cdn.simpleicons.org/wechat/07C160',
  qqpay: 'https://cdn.simpleicons.org/tencentqq/12B7F5',
};

const formatCountdown = (seconds) => {
  const total = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(total / 60);
  const remainSeconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainSeconds).padStart(2, '0')}`;
};

const TopUp = () => {
  const [searchParams] = useSearchParams();
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);
  const isMobile = useIsMobile();

  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [topUpCount, setTopUpCount] = useState(1);
  const [customInput, setCustomInput] = useState('');
  const [affLink, setAffLink] = useState('');
  const [topups, setTopups] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [paymentNow, setPaymentNow] = useState(Date.now());

  const minTopUp = statusState?.status?.min_topup || 1;
  const epayEnabled = !!statusState?.status?.epay_enabled;
  const payMethods = Array.isArray(statusState?.status?.pay_methods) ? statusState.status.pay_methods : [];
  const epayPrice = Number(statusState?.status?.epay_price) || 1;
  const epayMin = statusState?.status?.epay_min_topup || 1;

  // 构造支付方式列表：易支付各方式
  const methods = epayEnabled
    ? payMethods.filter((m) => m?.type).map((m) => ({ id: `epay:${m.type}`, name: m.name || m.type, type: m.type, min_topup: m.min_topup }))
    : [];
  const [selectedMethod, setSelectedMethod] = useState('');
  const activeMethod = methods.find((m) => m.id === selectedMethod) || methods[0];
  const [methodPickerOpen, setMethodPickerOpen] = useState(false);

  const refreshUser = async () => {
    try {
      const { data } = await API.get('/api/user/self');
      if (data.success) {
        userDispatch?.({ type: 'login', payload: data.data });
        return data.data;
      }
    } catch (e) { showError(e); }
    return null;
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

  useEffect(() => {
    if (!paymentOrder) return undefined;
    const timer = setInterval(() => {
      refreshUser();
      loadTopups();
    }, 5000);
    return () => clearInterval(timer);
  }, [paymentOrder]);

  useEffect(() => {
    if (!paymentOrder?.expiresAt) return undefined;
    setPaymentNow(Date.now());
    const timer = setInterval(() => setPaymentNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [paymentOrder?.expiresAt]);

  const redeem = async () => {
    const key = code.trim();
    if (!key) return showInfo('请输入兑换码');
    setRedeeming(true);
    try {
      try {
        const sub = await API.post('/api/subscription/redeem', { key }, { skipErrorHandler: true });
        if (sub.data?.success) {
          showSuccess('已激活订阅：' + (sub.data.data?.plan_title || ''));
          setCode(''); setRedeemOpen(false); refreshUser();
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
        setCode(''); setRedeemOpen(false); refreshUser();
      } else showError(data.message);
    } catch (e) { showError(e); } finally { setRedeeming(false); }
  };

  const u = userState?.user || {};
  const AMOUNTS = useMemo(() => {
    const raw = statusState?.status?.topup_preset_amounts;
    const parsed = (typeof raw === 'string' ? raw : '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    return parsed.length ? parsed : [1, 20, 100];
  }, [statusState?.status?.topup_preset_amounts]);
  const epayMethodMin = Number(activeMethod?.min_topup) || epayMin;
  const payTotal = topUpCount * epayPrice;
  const payTotalText = `¥${payTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const checkout = async (method) => {
    const payMethod = method || activeMethod;
    if (!payMethod) return showError('请选择支付方式');
    const methodMin = Number(payMethod.min_topup) || epayMin;
    if (payMethod.id?.startsWith('epay:')) {
      if (topUpCount < methodMin) return showError(`最低充值数量为 ${methodMin}`);
      setCheckingOut(true);
      try {
        const { data } = await API.post('/api/user/payment/epay/checkout', { amount: topUpCount, type: payMethod.type });
        if (data.success && data.data?.pay_url) {
          const expiresIn = Number(data.data.expires_in) || 180;
          setMethodPickerOpen(false);
          setPaymentOrder({
            payUrl: data.data.pay_url,
            qrValue: data.data.qr_value,
            qrUrl: data.data.qr_url,
            h5Url: data.data.h5_url,
            tradeNo: data.data.trade_no,
            methodName: payMethod.name,
            methodType: payMethod.type,
            amount: topUpCount,
            totalText: payTotalText,
            expiresAt: Date.now() + expiresIn * 1000,
          });
          loadTopups();
        } else showError(data.message || '创建支付订单失败');
      } catch (e) { showError(e); } finally { setCheckingOut(false); }
      return;
    }
  };

  // 点击结账：多渠道时弹出选择弹窗，单渠道直接下单
  const handleCheckoutClick = () => {
    if (topUpCount < epayMethodMin) return showError(`最低充值数量为 ${epayMethodMin}`);
    if (methods.length > 1) {
      setMethodPickerOpen(true);
    } else {
      checkout(methods[0]);
    }
  };

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

      {/* 立即充值 */}
      {epayEnabled && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--ui-text)' }}>立即充值</span>
            <button
              onClick={() => setRedeemOpen(true)}
              style={{ cursor: 'pointer', height: 32, paddingInline: 16, border: '1px solid var(--ui-border)', borderRadius: 24, fontSize: 13, color: 'var(--ui-text-2)', background: 'transparent' }}
            >兑换码</button>
          </div>
          {/* 金额选择 */}
          <div style={{ display: 'flex', gap: 8 }}>
            {AMOUNTS.map((amt) => (
              <button
                key={amt}
                onClick={() => { setTopUpCount(amt); setCustomInput(''); }}
                style={{
                  cursor: 'pointer', flex: '1 1 0', minWidth: 0, height: 45, border: topUpCount === amt ? '2px solid #000' : '1px solid #e5e5e5',
                  borderRadius: 10, fontSize: 16, fontWeight: topUpCount === amt ? 600 : 400,
                  color: 'var(--ui-text)', background: 'var(--page-bg)',
                  boxShadow: topUpCount === amt ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
              >${amt}</button>
            ))}
            <input
              type="number"
              min={1}
              placeholder="自定义"
              value={customInput}
              onChange={(e) => {
                const raw = e.target.value;
                setCustomInput(raw);
                const v = Number(raw);
                if (raw !== '' && v > 0) setTopUpCount(v);
              }}
              onFocus={() => {
                if (AMOUNTS.includes(topUpCount)) setCustomInput('');
              }}
              style={{
                flex: '1 1 0', minWidth: 0, width: 0, height: 45, border: !AMOUNTS.includes(topUpCount) ? '2px solid #000' : '1px solid #e5e5e5',
                borderRadius: 10, fontSize: 16, fontWeight: 400, textAlign: 'center',
                color: 'var(--ui-text)', background: 'var(--page-bg)',
                outline: 'none', boxSizing: 'border-box',
                boxShadow: !AMOUNTS.includes(topUpCount) ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
            />
          </div>
          {/* 支付摘要 */}
          <div style={{ border: '1px solid var(--ui-border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 18px' }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--ui-text-3)', marginBottom: 6 }}>支付总计</div>
                <div style={{ fontSize: 28, fontWeight: 400, color: 'var(--ui-text)' }}>{payTotalText}</div>
              </div>
              <div style={{ padding: '2px 10px', border: '1px solid var(--ui-border)', borderRadius: 10, fontSize: 12, fontWeight: 500, color: 'rgba(0,0,0,0.3)', background: 'var(--page-bg)' }}>
                {`$1 = ¥${epayPrice}`}
              </div>
            </div>
          </div>
          {/* 结账按钮 */}
          <button
            onClick={handleCheckoutClick}
            disabled={checkingOut}
            style={{
              cursor: checkingOut ? 'not-allowed' : 'pointer', width: '100%', height: 48, border: 'none', borderRadius: 999,
              fontSize: 16, fontWeight: 600, color: 'var(--ui-accent-fg)', background: 'var(--ui-accent)',
              opacity: checkingOut ? 0.6 : 1,
            }}
          >{checkingOut ? '正在创建订单...' : '生成支付二维码'}</button>
        </div>
      )}

      {/* 邀请奖励 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--ui-text)' }}>邀请奖励</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          <div style={{ padding: '16px 18px', border: '1px solid var(--ui-border)', borderRadius: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 6 }}>邀请人数</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--ui-text)' }}>{u.aff_count || 0}</div>
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

      {/* 兑换码弹窗 */}
      {redeemOpen && (
        <Modal
          open
          title='兑换码'
          onClose={() => setRedeemOpen(false)}
          onConfirm={redeem}
          loading={redeeming}
          confirmText='兑换'
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 14, color: 'var(--ui-text-3)' }}>输入兑换码，立即获得对应额度或激活订阅</div>
            <Input
              value={code}
              onChange={setCode}
              onKeyDown={(e) => e.key === 'Enter' && redeem()}
              placeholder='XXXX-XXXX-XXXX-XXXX'
              width='full'
              className='font-mono'
            />
          </div>
        </Modal>
      )}

      {/* 支付渠道选择弹窗 */}
      {methodPickerOpen && (
        <Modal
          open
          title='选择支付方式'
          onClose={() => setMethodPickerOpen(false)}
          hideFooter
          width={400}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
              <span style={{ fontSize: 13, color: 'var(--ui-text-3)' }}>支付总计</span>
              <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--ui-text)' }}>{payTotalText}</span>
            </div>
            {methods.map((m) => (
              <button
                key={m.id}
                onClick={() => checkout(m)}
                disabled={checkingOut}
                style={{
                  cursor: checkingOut ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 12,
                  height: 56, paddingInline: 18, width: '100%',
                  border: '1px solid var(--ui-border)', borderRadius: 14,
                  fontSize: 15, fontWeight: 500, color: 'var(--ui-text)',
                  background: 'var(--page-bg)', textAlign: 'left',
                  opacity: checkingOut ? 0.6 : 1, transition: 'border-color 0.2s',
                }}
                onMouseEnter={(e) => { if (!checkingOut) e.currentTarget.style.borderColor = '#000'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--ui-border)'; }}
              >
                <img
                  alt={m.name}
                  src={PAYMENT_ICON_CDN[m.type] || PAYMENT_ICON_CDN.alipay}
                  style={{ width: 26, height: 26, display: 'block' }}
                />
                <span style={{ flex: 1 }}>{m.name}</span>
                {checkingOut && <Loading size='xs' />}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* 支付二维码弹窗 */}
      {paymentOrder && (
        <Modal
          open
          title='扫码支付'
          onClose={() => setPaymentOrder(null)}
          hideFooter
          width={430}
        >
          <div className='flex flex-col items-center gap-4'>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <img
                alt={paymentOrder.methodName || '支付渠道'}
                src={PAYMENT_ICON_CDN[paymentOrder.methodType] || PAYMENT_ICON_CDN.alipay}
                style={{ width: 30, height: 30, display: 'block' }}
              />
              <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--ui-text)' }}>{paymentOrder.totalText}</div>
            </div>
            <QRCode value={paymentOrder.qrValue || paymentOrder.payUrl} size={240} bordered={false} bgColor='transparent' />
            <div style={{ width: '100%', fontSize: 12, color: 'var(--ui-text-3)', textAlign: 'center', wordBreak: 'break-all' }}>
              订单号：{paymentOrder.tradeNo || '-'}
            </div>
            {paymentOrder.expiresAt && (
              <div style={{ fontSize: 13, fontWeight: 600, color: paymentOrder.expiresAt <= paymentNow ? '#dc2626' : 'var(--ui-text)' }}>
                {paymentOrder.expiresAt <= paymentNow
                  ? '二维码已过期'
                  : `剩余支付时间 ${formatCountdown((paymentOrder.expiresAt - paymentNow) / 1000)}`}
              </div>
            )}
            <Button
              icon={RefreshCw}
              onClick={async () => {
                await refreshUser();
                await loadTopups();
                showSuccess('已刷新支付状态');
              }}
            >
              我已完成支付
            </Button>
            <div style={{ fontSize: 12, color: 'var(--ui-text-3)', textAlign: 'center', lineHeight: 1.6 }}>
              使用手机扫码完成支付，支付成功后余额会自动刷新。
            </div>
          </div>
        </Modal>
      )}

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
    </div>
  );
};

export default TopUp;

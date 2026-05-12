import React, { useContext, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, Copy } from 'lucide-react';
import { API, showError, showSuccess, showInfo, copy, renderQuota } from '../../helpers';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import {
  PageShell, Card, Button, IconButton, Input, NumberInput, Modal, Loading, Tag,
} from '../../components/ui';

const TopUp = () => {
  const [searchParams] = useSearchParams();
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);

  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [topUpCount, setTopUpCount] = useState(statusState?.status?.min_topup || 10);
  const [affLink, setAffLink] = useState('');
  const [subscriptions, setSubscriptions] = useState([]);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferAmount, setTransferAmount] = useState(0);
  const [transferring, setTransferring] = useState(false);

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

  const loadSubs = async () => {
    try {
      const res = await API.get('/api/subscription/self');
      if (res.data?.success) setSubscriptions(res.data.data?.subscriptions || []);
    } catch {}
  };

  useEffect(() => {
    refreshUser(); loadAff(); loadSubs();
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
          setCode(''); refreshUser(); loadSubs();
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

  return (
    <PageShell title='钱包' actions={<IconButton icon={RefreshCw} title='刷新' onClick={refreshUser} />}>
      <Card className='mb-5'>
        <div className='grid md:grid-cols-3 gap-6'>
          <div className='md:col-span-2'>
            <div className='text-ui-text-3 text-xs uppercase tracking-widest mb-3'>当前余额</div>
            <div className='text-4xl md:text-5xl font-medium text-ui-text-1 tabular-nums'>
              {renderQuota(u.quota || 0)}
            </div>
            <p className='mt-2 text-sm text-ui-text-3'>累计已使用 {renderQuota(u.used_quota || 0)}</p>
          </div>
        </div>
      </Card>

      {subscriptions.length > 0 && (
        <Card className='mb-5'>
          <h3 className='text-sm font-semibold text-ui-text-1 mb-3'>我的订阅</h3>
          <div className='space-y-3'>
            {subscriptions.map((row) => {
              const s = row.subscription || {};
              const expired = (s.end_time || 0) > 0 && s.end_time < Date.now() / 1000;
              const active = s.status === 'active' && !expired;
              return (
                <div key={s.id} className='flex items-center justify-between p-3 rounded-lg border border-ui-border'>
                  <div>
                    <div className='text-sm text-ui-text-1 font-medium'>套餐 #{s.plan_id}</div>
                    <div className='text-xs text-ui-text-3 mt-1'>
                      {s.start_time ? new Date(s.start_time * 1000).toLocaleDateString() : '-'} ~ {s.end_time ? new Date(s.end_time * 1000).toLocaleDateString() : '-'}
                    </div>
                  </div>
                  <Tag color={active ? 'green' : expired ? 'red' : 'grey'}>
                    {active ? '生效中' : expired ? '已过期' : '已取消'}
                  </Tag>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className={`grid grid-cols-1 ${topUpLink ? 'md:grid-cols-2' : ''} gap-4 mb-5`}>
        <Card>
          <h3 className='text-sm font-semibold text-ui-text-1 mb-3'>兑换码</h3>
          <p className='text-xs text-ui-text-3 mb-3'>输入管理员发放的兑换码，立即获得对应额度或激活订阅</p>
          <div className='flex gap-2'>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && redeem()}
              placeholder='XXXX-XXXX-XXXX-XXXX'
              className='flex-1 font-mono'
            />
            <Button onClick={redeem} loading={redeeming} disabled={!code.trim()}>兑换</Button>
          </div>
        </Card>

        {topUpLink && (
          <Card>
            <h3 className='text-sm font-semibold text-ui-text-1 mb-3'>快捷充值</h3>
            <p className='text-xs text-ui-text-3 mb-3'>跳转到外部充值页面完成支付</p>
            <div className='flex flex-wrap gap-2 mb-3'>
              {[10, 50, 100, 500].map((amt) => (
                <Button key={amt} size='sm' variant='toggle' selected={topUpCount === amt}
                  onClick={() => setTopUpCount(amt)}>${amt}</Button>
              ))}
              <NumberInput value={topUpCount} onChange={(v) => setTopUpCount(Number(v))} min={minTopUp} className='w-24' />
            </div>
            <Button className='w-full' onClick={() => window.open(topUpLink, '_blank')}>前往充值</Button>
          </Card>
        )}
      </div>

      <Card>
        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-sm font-semibold text-ui-text-1'>邀请奖励</h3>
          <Button variant='toggle' onClick={() => setTransferOpen(true)} disabled={(u.aff_quota || 0) <= 0}>划转到余额</Button>
        </div>
        <div className='grid grid-cols-3 gap-4 mb-4'>
          <div>
            <div className='text-[11px] uppercase tracking-wider text-ui-text-3 mb-1'>邀请人数</div>
            <div className='text-2xl font-medium text-ui-text-1 tabular-nums'>{u.aff_count || 0}</div>
          </div>
          <div>
            <div className='text-[11px] uppercase tracking-wider text-ui-text-3 mb-1'>可用奖励</div>
            <div className='text-2xl font-medium text-ui-text-1 tabular-nums'>{renderQuota(u.aff_quota || 0)}</div>
          </div>
          <div>
            <div className='text-[11px] uppercase tracking-wider text-ui-text-3 mb-1'>累计奖励</div>
            <div className='text-2xl font-medium text-ui-text-2 tabular-nums'>{renderQuota(u.aff_history_quota || 0)}</div>
          </div>
        </div>
        {affLink && (
          <div className='flex items-center gap-2 p-2 bg-ui-bg-subtle border border-ui-border rounded-lg'>
            <code className='flex-1 text-xs font-mono text-ui-text-2 truncate select-all'>{affLink}</code>
            <IconButton icon={Copy} onClick={async () => { await copy(affLink); showSuccess('已复制邀请链接'); }} />
          </div>
        )}
      </Card>

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
              <label className='block text-sm text-ui-text-2 mb-1.5'>划转额度</label>
              <NumberInput value={transferAmount} onChange={(v) => setTransferAmount(Number(v) || 0)} min={0} max={u.aff_quota || 0} />
              <p className='mt-1 text-xs text-ui-text-3'>可划转：{renderQuota(u.aff_quota || 0)}</p>
            </div>
          </div>
        </Modal>
      )}
    </PageShell>
  );
};

export default TopUp;

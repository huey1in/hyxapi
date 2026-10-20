import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { API, copy, renderQuota } from '../../helpers';
import { Button, Input, Select, showError, showSuccess } from '../../components/ui';
import { useAuthStore } from '../../stores/auth-store';
import { apiErrorMessage } from '../../lib/api-error';
import { paymentMethods, paymentError, paymentSucceeded, topUpRequest, safePaymentURL } from '../../features/payments/payment-core';
import { walletProfileSchema, affiliateURL } from '../../features/payments/wallet-data';
import { readWalletData, useWalletOffers, useWalletPaymentInfo, walletRequestConfig } from '../../features/payments/wallet-query';
import { InvitationRewards, TopUpPage, WalletBalanceCard } from '../../features/payments/TopUpLayout';
import { AffiliateTransferDialog, RedemptionDialog } from '../../features/payments/WalletDialogs';
import TopUpHistory from '../../features/payments/TopUpHistory';
import usePaymentCheckout from '../../features/payments/usePaymentCheckout';
import SubscriptionOffers from '../../features/payments/SubscriptionOffers';

type Quote = { key: string; value?: number; error?: string };
function TopUp({ identity }: { identity: string }) {
  const { t, i18n } = useTranslation(); const [searchParams] = useSearchParams();
  const auth = useAuthStore((state) => state.auth); const userId = auth.user?.id; const role = auth.user?.role ?? 0;
  const [redeemOpen, setRedeemOpen] = useState(false); const [transferOpen, setTransferOpen] = useState(false); const [showHistory, setShowHistory] = useState(false);
  const [draft, setDraft] = useState('1'); const [custom, setCustom] = useState(false); const [selectedMethod, setSelectedMethod] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null); const [quoteGeneration, setQuoteGeneration] = useState(0);
  const { checkingOut, checkout } = usePaymentCheckout();
  const info = useWalletPaymentInfo(identity); const paymentInfo = info.isError ? undefined : info.data;
  const offers = useWalletOffers(identity);
  const profile = useQuery({ queryKey: ['wallet-profile', identity], gcTime: 0, retry: false, queryFn: async ({ signal }) => {
    const result = await readWalletData('/api/user/self', walletProfileSchema, signal);
    if (result.id !== userId) throw new Error('Invalid wallet data; reload and try again.'); return result;
  } });
  const user = profile.isError ? undefined : profile.data;
  useEffect(() => { if (profile.data && !profile.isError) useAuthStore.getState().auth.setUser(profile.data); }, [profile.data, profile.isError]);
  const affiliate = useQuery({ queryKey: ['wallet-affiliate', identity], gcTime: 0, retry: false, queryFn: ({ signal }) => readWalletData('/api/user/aff', z.string().min(1), signal) });
  const affLink = affiliate.data && !affiliate.isError ? affiliateURL(affiliate.data, window.location.origin) : '';
  const refreshUser = () => { void profile.refetch(); };
  const methods = useMemo(() => paymentMethods(paymentInfo ?? null), [paymentInfo]);
  const method = methods.find((item) => item.id === selectedMethod) || methods[0];
  const units = draft.trim() ? Number(draft) : NaN;
  const quoteKey = `${method?.id}:${draft}:${info.dataUpdatedAt}:${quoteGeneration}`;
  const currentQuote = quote?.key === quoteKey ? quote : null;
  useEffect(() => {
    if (!method || !paymentInfo) return;
    const owner = new AbortController(); const key = quoteKey;
    if (method.provider === 'creem') { setQuote({ key, value: method.price }); return; }
    let request;
    try { request = topUpRequest(method, units, paymentInfo, true); }
    catch (error) { setQuote({ key, error: apiErrorMessage(error, 'Unable to get quote') }); return; }
    if (!request) return;
    const timer = setTimeout(async () => {
      try {
        const { data } = await API.post<unknown>(request.url, request.body, { ...walletRequestConfig, signal: owner.signal });
        owner.signal.throwIfAborted();
        if (!paymentSucceeded(data)) throw new Error(paymentError(data));
        const response = z.object({ data: z.union([z.number(), z.string().regex(/^\d+(?:\.\d+)?$/)]) }).safeParse(data);
        const value = response.success ? Number(response.data.data) : NaN;
        if (!Number.isFinite(value) || value <= 0) throw new Error('Invalid quote; reload and try again.');
        setQuote({ key, value });
      } catch (error) { if (!owner.signal.aborted) setQuote({ key, error: apiErrorMessage(error, 'Unable to get quote') }); }
    }, 250);
    return () => { clearTimeout(timer); owner.abort(); };
  }, [quoteKey, units, method, paymentInfo]);
  const amounts = [...new Set(paymentInfo?.amount_options?.length ? paymentInfo.amount_options : [1, 20, 100])];
  const canCheckout = currentQuote?.value !== undefined && !currentQuote.error && Boolean(method) && Boolean(paymentInfo);
  const payTotal = currentQuote?.error ? '—' : currentQuote?.value !== undefined ? new Intl.NumberFormat(i18n.language, { style: 'currency', currency: method?.currency || 'USD' }).format(currentQuote.value) : t('Getting quote…');
  const startCheckout = () => {
    if (!canCheckout || !method || !paymentInfo) return;
    try { const request = topUpRequest(method, method.provider === 'creem' ? 1 : units, paymentInfo); if (request) void checkout(request); }
    catch (error) { showError(t(apiErrorMessage(error, 'Payment request failed'))); }
  };
  let otherLink = '';
  if (paymentInfo?.topup_link) { try { otherLink = safePaymentURL(paymentInfo.topup_link, window.location.origin); } catch { /* A malformed optional link is not actionable. */ } }
  const canRedeem = paymentInfo?.enable_redemption === true;
  return <TopUpPage pending={info.isPending || offers.isPending}>
    <WalletBalanceCard user={user} pending={profile.isPending} onHistory={() => setShowHistory(true)} />
    {profile.isError && <div role='alert' className='space-y-2 text-sm text-ui-danger'><p>{t(apiErrorMessage(profile.error, 'Unable to load wallet data'))}</p><Button onClick={refreshUser}>{t('Retry')}</Button></div>}
    {info.isError ? <div role='alert' className='space-y-2 text-sm text-ui-danger'><p>{t(apiErrorMessage(info.error, 'Unable to load payment methods'))}</p><Button onClick={() => void info.refetch()}>{t('Retry')}</Button></div> : methods.length > 0 && <section className='flex flex-col gap-4'>
      <div className='flex items-center justify-between gap-2'><h2 className='text-lg font-semibold text-ui-text'>{t('Top up now')}</h2>{canRedeem && <Button size='sm' variant='secondary' onClick={() => setRedeemOpen(true)}>{t('Redemption code')}</Button>}</div>
      <Select width='full' aria-label={t('Payment method')} value={method?.id || ''} onChange={setSelectedMethod} disabled={checkingOut} options={methods.map((item) => ({ value: item.id, label: t(item.name) }))} />
      {method?.provider !== 'creem' && <fieldset disabled={checkingOut} className='grid gap-2' style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))' }}>
        {amounts.map((amount) => <button key={amount} onClick={() => { setDraft(String(amount)); setCustom(false); }} style={{ cursor: 'pointer', minWidth: 0, height: 45, border: !custom && units === amount ? '2px solid #000' : '1px solid #e5e5e5', borderRadius: 10, fontSize: 16, fontWeight: !custom && units === amount ? 600 : 400, color: 'var(--ui-text)', background: 'var(--page-bg)', boxShadow: !custom && units === amount ? '0 2px 8px rgba(0,0,0,0.08)' : 'none' }}>${amount}</button>)}
        <Input type='number' min={method?.min ?? 1} step='1' aria-label={t('Custom top-up amount')} placeholder={t('Custom amount')} value={custom ? draft : ''} onChange={(value) => { setDraft(value); setCustom(true); }} size={45} />
      </fieldset>}
      <div className='flex items-start justify-between gap-2 overflow-hidden rounded-xl border border-ui-border px-[18px] py-4'>
        <div><div className='mb-1.5 text-[13px] text-ui-text-3'>{t('Payment total')}</div><div className='text-[28px] text-ui-text'>{payTotal}</div></div>
        <span className='rounded-[10px] border border-ui-border px-2.5 py-0.5 text-xs text-ui-text-3'>{method?.provider === 'creem' ? renderQuota(method.quota) : t('Credits: {{amount}}', { amount: Number.isFinite(units) && units > 0 ? draft : '—' })}</span>
      </div>
      <button onClick={startCheckout} disabled={checkingOut || !canCheckout} style={{ cursor: checkingOut || !canCheckout ? 'not-allowed' : 'pointer', width: '100%', height: 48, border: 'none', borderRadius: 999, fontSize: 16, fontWeight: 600, color: 'var(--ui-accent-fg)', background: 'var(--ui-accent)', opacity: checkingOut || !canCheckout ? 0.6 : 1 }}>{t(checkingOut ? 'Creating order…' : 'Proceed to payment')}</button>
      {currentQuote?.error && <div role='alert' className='space-y-2 text-sm text-ui-danger'><p>{t(currentQuote.error)}</p><Button size='sm' variant='link' onClick={() => setQuoteGeneration((value) => value + 1)}>{t('Retry quote')}</Button></div>}
    </section>}
    {!methods.length && canRedeem && <Button variant='link' onClick={() => setRedeemOpen(true)}>{t('Use redemption code')}</Button>}
    {otherLink && <a href={otherLink} target='_blank' rel='noopener noreferrer' className='text-sm text-ui-text-2 underline'>{t('Other top-up methods')}</a>}
    <SubscriptionOffers onPurchased={refreshUser} />
    <InvitationRewards user={user} pending={profile.isPending} link={affLink} linkPending={affiliate.isPending}
      transferDisabled={!user || !paymentInfo?.payment_compliance_confirmed || user.aff_quota < Math.ceil(paymentInfo.quota_per_unit)}
      onTransfer={() => setTransferOpen(true)} onCopy={async () => { if (await copy(affLink)) showSuccess(t('Invitation link copied')); }}>
      {affiliate.isError && <div role='alert' className='text-sm text-ui-danger'><p>{t(apiErrorMessage(affiliate.error, 'Unable to load invitation link'))}</p><Button variant='link' onClick={() => void affiliate.refetch()}>{t('Retry')}</Button></div>}
    </InvitationRewards>
    {redeemOpen && canRedeem && <RedemptionDialog initialCode={searchParams.get('code') || ''} onClose={() => setRedeemOpen(false)} onSaved={refreshUser} />}
    {transferOpen && user && paymentInfo && <AffiliateTransferDialog quotaPerUnit={paymentInfo.quota_per_unit} available={user.aff_quota} onClose={() => setTransferOpen(false)} onSaved={refreshUser} />}
    {showHistory && <TopUpHistory identity={identity} role={role} onClose={() => setShowHistory(false)} onSaved={refreshUser} />}
  </TopUpPage>;
}
export default function TopUpAccount() {
  const identity = useAuthStore((state) => `${state.auth.user?.id}:${state.auth.session?.sid}:${state.auth.user?.role}`);
  return <TopUp key={identity} identity={identity} />;
}

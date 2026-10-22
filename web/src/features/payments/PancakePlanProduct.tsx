import { useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { API } from '../../helpers';
import { Button, ConfirmDialog, EmptyState, Input, Select, showSuccess } from '../../components/ui';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { paymentError, paymentSucceeded } from './payment-core';
import { walletRequestConfig } from './wallet-query';

type Props = { title: string; price: number; value: string; onChange: (value: string) => void; disabled?: boolean };
function CreateProduct({ title, price, onClose, onCreated }: { title: string; price: number; onClose: () => void; onCreated: (id: string) => void }) {
  const { t } = useTranslation(); const { busy, run } = useOwnedOperation();
  return <ConfirmDialog open title={t('Create Pancake plan product?')} description={t('Create {{title}} in the configured store at USD {{price}}.', { title, price: price.toFixed(2) })} closeOnConfirm={false} loading={busy} confirmText={t('Create product')} cancelText={t('Cancel')} onClose={onClose} onConfirm={() => void run(async (signal) => {
    const { data } = await API.post<unknown>('/api/option/waffo-pancake/subscription-product', { name: title, amount: price.toFixed(2) }, { ...walletRequestConfig, signal, timeout: 30000 });
    signal.throwIfAborted(); if (!paymentSucceeded(data)) throw new Error(paymentError(data));
    const result = z.object({ data: z.object({ product_id: z.string().min(1) }) }).safeParse(data);
    if (!result.success) throw new Error('Invalid product response');
    onCreated(result.data.data.product_id); showSuccess(t('Plan product created. Save the plan to apply it.'));
  })} />;
}

export default function PancakePlanProduct({ title, price, value, onChange, disabled = false }: Props) {
  const { t } = useTranslation(); const { busy, run } = useOwnedOperation();
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]); const [loaded, setLoaded] = useState(false); const [confirm, setConfirm] = useState(false);
  const validPrice = Number.isFinite(price) && price > 0 && Number(price.toFixed(2)) === price;
  const load = () => void run(async (signal) => {
    setProducts([]); setLoaded(false);
    const { data } = await API.get<unknown>('/api/option/waffo-pancake/subscription-product-options', { ...walletRequestConfig, signal, timeout: 30000 });
    signal.throwIfAborted(); if (!paymentSucceeded(data)) throw new Error(paymentError(data));
    const result = z.object({ data: z.object({ products: z.array(z.object({ id: z.string().min(1), name: z.string() })).nullable() }) }).safeParse(data);
    if (!result.success) throw new Error('Invalid product response');
    setProducts(result.data.data.products ?? []); setLoaded(true);
  });
  return <div className='space-y-2'>
    <label className='block space-y-1.5 text-sm text-ui-text-2'>Pancake Product ID<Input width='full' value={value} onChange={onChange} disabled={disabled || busy || confirm} /></label>
    {products.length > 0 && <Select aria-label={t('Bound store products')} width='full' value={value} disabled={disabled || busy || confirm} onChange={onChange} options={products.map((product) => ({ value: product.id, label: product.name || product.id }))} />}
    {loaded && !products.length && <EmptyState icon={ShoppingBag} padding='sm' title={t('No products in the bound store')} />}
    <div className='flex flex-wrap gap-2'><Button size='sm' loading={busy} disabled={disabled || confirm} onClick={load}>{t('Load bound store products')}</Button><Button size='sm' disabled={disabled || busy || confirm || !title.trim() || !validPrice} onClick={() => setConfirm(true)}>{t('Create plan product')}</Button></div>
    {price > 0 && !validPrice && <p className='text-xs text-ui-text-3'>{t('Pancake products require a positive price with at most 2 decimal places.')}</p>}
    {confirm && <CreateProduct title={title.trim()} price={price} onClose={() => setConfirm(false)} onCreated={(id) => { onChange(id); setConfirm(false); }} />}
  </div>;
}

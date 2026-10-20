import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { API } from '../../helpers';
import type { ApiEnvelope } from '../../types/api';
import { paymentInfoSchema } from './payment-core';
import { subscriptionSelfSchema } from './subscription-data';
import { subscriptionOffersSchema } from './wallet-data';

export const walletRequestConfig = { skipErrorHandler: true, disableDuplicate: true, timeout: 15000 };
export async function readWalletData<T>(path: string, schema: z.ZodType<T>, signal: AbortSignal, params?: Record<string, unknown>, invalidDataMessage = 'Invalid wallet data; reload and try again.'): Promise<T> {
  const { data } = await API.get<ApiEnvelope<unknown>>(path, { ...walletRequestConfig, signal, params });
  signal.throwIfAborted();
  if (!data.success) throw new Error(data.message || 'Unable to load wallet data');
  const parsed = schema.safeParse(data.data);
  if (!parsed.success) throw new Error(invalidDataMessage);
  return parsed.data;
}
export function useWalletPaymentInfo(identity: string) {
  return useQuery({ queryKey: ['wallet-payment-info', identity], queryFn: ({ signal }) => readWalletData('/api/user/topup/info', paymentInfoSchema, signal), retry: false, gcTime: 0, staleTime: 30000 });
}
export function useWalletSubscriptions(identity: string, refetchOnWindowFocus = true) {
  return useQuery({ queryKey: ['wallet-subscriptions', identity], queryFn: ({ signal }) => readWalletData('/api/subscription/self', subscriptionSelfSchema, signal), retry: false, gcTime: 0, refetchOnWindowFocus });
}
export function useWalletOffers(identity: string) {
  return useQuery({ queryKey: ['wallet-subscription-offers', identity], gcTime: 0, retry: false, queryFn: ({ signal }) => readWalletData('/api/subscription/plans', subscriptionOffersSchema, signal) });
}

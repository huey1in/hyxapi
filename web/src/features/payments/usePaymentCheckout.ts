import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API } from '../../helpers';
import { showError } from '../../components/ui';
import { apiErrorMessage } from '../../lib/api-error';
import { navigateCheckout, paymentError, paymentSucceeded } from './payment-core';
import type { PaymentRequest } from './payment-core';

export default function usePaymentCheckout() {
  const { t } = useTranslation();
  const [checkingOut, setCheckingOut] = useState(false);
  const lifetime = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const pending = useRef<Window | null>(null);
  useEffect(() => {
    const owner = new AbortController(); lifetime.current = owner;
    const cancel = () => { owner.abort(); pending.current?.close(); };
    window.addEventListener('pagehide', cancel);
    return () => { window.removeEventListener('pagehide', cancel); cancel(); };
  }, []);
  const checkout = async (request: PaymentRequest, onPaid?: (signal: AbortSignal) => Promise<void>) => {
    const owner = lifetime.current;
    if (busy.current || !owner || owner.signal.aborted) return;
    const { signal } = owner;
    busy.current = true; setCheckingOut(true);
    let popup: Window | null = null;
    try {
      if (!onPaid) {
        popup = window.open('about:blank', '_blank');
        if (!popup) throw new Error('Allow payment popups and try again.');
        popup.opener = null; pending.current = popup;
      }
      const { data } = await API.post<unknown>(request.url, request.body, { signal, timeout: 30000, skipErrorHandler: true, disableDuplicate: true });
      signal.throwIfAborted();
      if (!paymentSucceeded(data)) throw new Error(paymentError(data));
      if (onPaid) await onPaid(signal);
      else if (popup) navigateCheckout(data, popup, window.location.origin);
    } catch (error) {
      popup?.close();
      const message = apiErrorMessage(error, 'Payment request failed');
      if (!signal.aborted && message) showError(t(message));
    } finally {
      pending.current = null; busy.current = false;
      if (!signal.aborted) setCheckingOut(false);
    }
  };
  return { checkingOut, checkout };
}

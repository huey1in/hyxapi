import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { API, showSuccess } from '../../helpers';
import { Button, Modal, Switch } from '../../components/ui';
import type { ApiEnvelope } from '../../types/api';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';

type Props = { plan: { id: number; title?: string }; user?: { id: number; username: string }; onClose: () => void; onSaved: () => void };
export default function SubscriptionResetDialog({ plan, user, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const [advance, setAdvance] = useState(true);
  const { busy, run } = useOwnedOperation();
  const reset = () => run(async (signal) => {
    const endpoint = user ? `/api/subscription/admin/users/${user.id}/subscriptions/reset` : `/api/subscription/admin/plans/${plan.id}/subscriptions/reset`;
    const { data } = await API.post<ApiEnvelope<unknown>>(endpoint, { plan_id: plan.id, advance_reset_time: advance }, { signal, skipErrorHandler: true, disableDuplicate: true, timeout: 30000 });
    signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to reset subscription quota');
    const result = z.object({ reset_count: z.number().int().nonnegative().safe() }).safeParse(data.data);
    showSuccess(result.success ? t('Reset {{count}} subscriptions', { count: result.data.reset_count }) : t('Subscription quota reset')); onSaved();
  });
  return <Modal open title={t('Reset subscription quota')} onClose={onClose} footer={<div className='flex flex-wrap justify-end gap-2.5'><Button onClick={onClose}>{t('Cancel')}</Button><Button loading={busy} onClick={() => void reset()}>{t('Confirm reset')}</Button></div>}>
    <p className='text-sm text-ui-text-2'>{t('Clear active usage for {{target}} on plan {{plan}}.', { target: user?.username || t('All users'), plan: plan.title || t('Plan #{{id}}', { id: plan.id }) })}</p>
    <label className='flex items-center gap-2 text-sm text-ui-text-2'><Switch checked={advance} onChange={setAdvance} disabled={busy} />{t('Calculate the next reset time from now')}</label>
    <p className='text-xs text-ui-text-3'>{t(advance ? 'The next reset period starts at this operation.' : 'Keep the original next reset time.')}</p>
  </Modal>;
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API, renderQuota, showSuccess } from '../../helpers';
import { displayAmountToQuota } from '../../helpers/quota';
import { Button, Modal, NumberInput, Select } from '../../components/ui';
import type { ApiEnvelope } from '../../types/api';
import type { ManagedUser } from './user-management';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';

export default function UserQuotaDialog({ user, onClose, onSaved }: { user: ManagedUser; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const { busy, run } = useOwnedOperation();
  const [mode, setMode] = useState('add');
  const [amount, setAmount] = useState<number | ''>(0);
  return <Modal open title={t('Adjust quota · {{username}}', { username: user.username })} onClose={() => { if (!busy) onClose(); }} hideFooter width={400}>
    <div className='space-y-4 p-1'>
      <p className='text-sm'>{t('Current balance')}: {renderQuota(user.quota, 2)}</p>
      <label className='block space-y-1.5 text-sm'>{t('Operation')}<Select aria-label={t('Operation')} options={[{ value: 'add', label: t('Add') }, { value: 'subtract', label: t('Subtract') }, { value: 'override', label: t('Override') }]} value={mode} onChange={setMode} width='full' /></label>
      <label className='block space-y-1.5 text-sm'>{t('Amount')}<NumberInput aria-label={t('Amount')} value={amount} onChange={setAmount} min={0} step='any' width='full' /></label>
      <div className='flex justify-end gap-2'><Button variant='toggle' disabled={busy} onClick={onClose}>{t('Cancel')}</Button><Button loading={busy} onClick={() => run(async (signal) => {
        if (amount === '' || !Number.isFinite(amount) || amount < 0 || (amount === 0 && mode !== 'override')) throw new Error('Enter a positive amount; override also accepts zero');
        const { data } = await API.post<ApiEnvelope<unknown>>('/api/user/manage', { id: user.id, action: 'add_quota', mode, value: displayAmountToQuota(amount) }, { signal, skipErrorHandler: true });
        signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to adjust quota'); showSuccess(t('Quota adjusted')); onSaved();
      })}>{t('Confirm')}</Button></div>
    </div>
  </Modal>;
}

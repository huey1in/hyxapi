import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Modal } from '../../components/ui';
import { dashboardCustomRange, dashboardLocalTime } from './dashboard-data';

type TimeRange = { start_timestamp: number; end_timestamp: number };

export default function DashboardRangeDialog({ initialRange, onApply, onClose }: {
  initialRange: TimeRange;
  onApply: (range: TimeRange) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [start, setStart] = useState(() => dashboardLocalTime(initialRange.start_timestamp));
  const [end, setEnd] = useState(() => dashboardLocalTime(initialRange.end_timestamp));
  const [error, setError] = useState('');
  const now = dashboardLocalTime(Math.floor(Date.now() / 1000));

  return <Modal open title={<span id='dashboard-range-title'>{t('Custom range')}</span>} width={420} hideFooter onClose={onClose}>
    <form role='dialog' aria-modal='true' aria-labelledby='dashboard-range-title' className='space-y-4 pb-2' onSubmit={(event) => {
      event.preventDefault();
      try { onApply(dashboardCustomRange(start, end)); }
      catch { setError(t('Invalid time range')); }
    }}>
      <div className='space-y-1.5'>
        <label htmlFor='dashboard-start' className='block text-sm text-ui-text-2'>{t('Start time')}</label>
        <Input id='dashboard-start' type='datetime-local' autoFocus required value={start} max={end || now} onChange={(value) => { setStart(value); setError(''); }} width='full' />
      </div>
      <div className='space-y-1.5'>
        <label htmlFor='dashboard-end' className='block text-sm text-ui-text-2'>{t('End time')}</label>
        <Input id='dashboard-end' type='datetime-local' required value={end} min={start} max={now} onChange={(value) => { setEnd(value); setError(''); }} width='full' />
      </div>
      {error && <p role='alert' className='text-sm text-ui-danger'>{error}</p>}
      <div className='flex justify-end gap-2 pt-2'>
        <Button type='button' onClick={onClose}>{t('Cancel')}</Button>
        <Button type='submit' variant='primary'>{t('Apply')}</Button>
      </div>
    </form>
  </Modal>;
}

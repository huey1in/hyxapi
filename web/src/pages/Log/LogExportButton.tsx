import { useTranslation } from 'react-i18next';
import { API } from '../../helpers';
import { Button, showError } from '../../components/ui';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { feedQuery, validateFeedFilters, type FeedFilters } from './feed-data';
import { feedToCSV } from './feed-export';

// The parent keys this control by session and applied filters, cancelling old exports.
export default function LogExportButton({ filters, role, all, sources }: { filters: FeedFilters; role: number; all: boolean; sources: readonly string[] }) {
  const { t } = useTranslation();
  const { busy, run } = useOwnedOperation();
  const exportLogs = () => {
    const error = validateFeedFilters(filters);
    if (error) { showError(t(error)); return; }
    void run(async (signal) => {
      const { data } = await API.get<string>(`${all ? '/api/log' : '/api/log/self'}/feed/export?${feedQuery(filters, all, role, sources)}`, {
        responseType: 'text', transformResponse: [(value: string) => value], timeout: 120000,
        signal, disableDuplicate: true, skipErrorHandler: true,
      });
      signal.throwIfAborted();
      const csv = feedToCSV(data, all ? role : 1, (key) => t(key));
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url;
      link.download = `hyxapi-logs-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  };
  return <Button size='md' variant='toggle' loading={busy} disabled={busy} onClick={exportLogs}>{t('Export CSV')}</Button>;
}

import { useTranslation } from 'react-i18next';
import { API } from '../../helpers';
import { Button, showError } from '../../components/ui';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { logsToCSV, logQuery } from './export';
import { validateLogFilters, type LogFilters } from './log-data';

// The parent keys this control by session and applied filters, cancelling old exports.
export default function LogExportButton({ filters, role, maxDays }: { filters: LogFilters; role: number; maxDays: unknown }) {
  const { t, i18n } = useTranslation();
  const { busy, run } = useOwnedOperation();
  const admin = role >= 10; const root = role >= 100;
  const exportLogs = () => {
    const error = validateLogFilters(filters, admin, maxDays, true);
    if (error) { showError(t(error)); return; }
    void run(async (signal) => {
      const { data } = await API.get<string>(`${admin ? '/api/log' : '/api/log/self'}/export?${logQuery(filters, admin, root)}`, {
        responseType: 'text', transformResponse: [(value: string) => value], timeout: 120000,
        signal, disableDuplicate: true, skipErrorHandler: true,
      });
      signal.throwIfAborted();
      const csv = logsToCSV(data, i18n.language, admin, root, (key) => t(key));
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url;
      link.download = `hyxware-logs-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  };
  return <Button size='sm' variant='toggle' loading={busy} disabled={busy} onClick={exportLogs}>{t('Export CSV')}</Button>;
}

import { useTranslation } from 'react-i18next';
import type { ModelHealthRecord } from '../../features/pricing/health-data';

const statusColor: Record<string, string> = { up: 'bg-emerald-500', degraded: 'bg-amber-500', down: 'bg-rose-500' };
export default function StatusBar({ history = [], slots = 60 }: { history?: ModelHealthRecord[]; slots?: number }) {
  const { t, i18n } = useTranslation();
  const count = Math.max(1, Math.min(80, Math.round(slots)));
  const active = history.filter((row) => row.status !== 'idle' && row.total > 0).slice(0, count).reverse();
  const number = (value: number) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(value);
  return <div className='flex items-stretch gap-[1.5px] h-7' aria-label={t('Recent service status')}>
    {Array.from({ length: Math.max(0, count - active.length) }, (_, index) => <div key={`empty-${index}`} title={t('No call data')} className='flex-1 rounded-xs bg-ui-bg-subtle' />)}
    {active.map((row, index) => {
      const time = new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(row.checked_at * 1000));
      const cache = row.prompt_tokens > 0 ? ` · ${t('Cache rate')} ${number(row.cache_tokens / row.prompt_tokens * 100)}%` : '';
      const title = t('{{time}} · Calls {{calls}} · Errors {{errors}} · Latency {{latency}} ms', { time, calls: number(row.total), errors: number(row.errors), latency: number(row.latency) }) + cache;
      return <div key={`${row.checked_at}-${index}`} title={title} className={`flex-1 rounded-xs ${statusColor[row.status] ?? 'bg-ui-bg-subtle'}`} />;
    })}
  </div>;
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Trophy, Users, Zap, Hash, Medal } from 'lucide-react';
import { API } from '../../helpers';
import { Button, EmptyState, Select } from '../../components/ui';
import ConsolePageHeader from '../../components/layout/ConsolePageHeader';
import { useAuthStore } from '../../stores/auth-store';
import { compactUsage, leaderboardSchema } from './leaderboard-data';
import type { LeaderboardMetric, LeaderboardPeriod } from './leaderboard-data';
import { LeaderboardSkeleton } from './LeaderboardLoading';
import ModelIcon from './ModelIcon';
import RankBadge from './RankBadge';

export default function Leaderboard() {
  const { t, i18n } = useTranslation();
  const auth = useAuthStore((state) => state.auth);
  const [period, setPeriod] = useState<LeaderboardPeriod>('today');
  const [metric, setMetric] = useState<LeaderboardMetric>('tokens');
  const query = useQuery({
    queryKey: ['leaderboard', auth.user?.id, auth.session?.sid, period, metric],
    enabled: !!auth.user, retry: false, staleTime: 60_000, gcTime: 0, refetchInterval: 60_000,
    queryFn: async ({ signal }) => {
      const { data } = await API.get('/api/leaderboard', { signal, timeout: 15_000, params: { period, metric }, disableDuplicate: true, skipErrorHandler: true });
      signal.throwIfAborted();
      if (!data.success) throw new Error('Unable to load leaderboard');
      return leaderboardSchema.parse(data.data);
    },
  });
  const data = query.data;
  const compact = (value: number) => compactUsage(value, i18n.language);
  const full = (value: number) => new Intl.NumberFormat(i18n.language).format(value);
  const percent = (value: number) => new Intl.NumberFormat(i18n.language, { style: 'percent', maximumFractionDigits: 1 }).format(value);
  const periods = [{ value: 'today', label: 'Today' }, { value: 'week', label: 'Last 7 days' }, { value: 'month', label: 'Last 30 days' }] as const;

  return <div className='console-content-page console-wide-page leaderboard-page'>
    <ConsolePageHeader title={t('Usage leaderboard')} />
    <div className='leaderboard-toolbar'>
      <div className='leaderboard-periods' role='group' aria-label={t('Time range')}>
        {periods.map((item) => <button key={item.value} type='button' aria-pressed={period === item.value} onClick={() => setPeriod(item.value)}>{t(item.label)}</button>)}
      </div>
      <Select size={32} aria-label={t('Ranking metric')} prefix={t('Rank by')} value={metric} onChange={setMetric} options={[{ value: 'tokens', label: 'Tokens' }, { value: 'requests', label: t('API requests') }]} />
    </div>

    {query.error && <div role='alert' className='leaderboard-error'><span>{t('Unable to load leaderboard')}</span><Button size='sm' onClick={() => void query.refetch()} loading={query.isFetching}>{t('Retry')}</Button></div>}
    {query.isPending ? <LeaderboardSkeleton /> : data && <div className='leaderboard-data'>
      <div className='leaderboard-stats'>
        {[
          { label: t('Active members'), value: full(data.active_users), icon: Users },
          { label: t('API requests'), value: compact(data.requests), detail: full(data.requests), icon: Hash },
          { label: t('Total tokens'), value: compact(data.tokens), detail: full(data.tokens), icon: Zap },
          { label: t('Your ranking'), value: data.my_rank ? `#${data.my_rank}` : '—', icon: Medal },
        ].map(({ label, value, detail, icon: Icon }) => <div className='leaderboard-stat' key={label}><div className='leaderboard-stat-label'><span>{label}</span><Icon size={15} aria-hidden='true' /></div><strong title={detail}>{value}</strong></div>)}
      </div>
      <div className='leaderboard-columns'>
        <section className='leaderboard-panel leaderboard-ranking' aria-labelledby='leaderboard-users-title'>
          <div className='leaderboard-section-heading'><h2 id='leaderboard-users-title'>{t('Member rankings')}</h2><span>TOP 100</span></div>
          {!data.users.length ? <EmptyState icon={Trophy} iconVariant='plain' title={t('No usage in this period')} /> : <table className='leaderboard-table'>
            <thead><tr><th>{t('Member')}</th><th aria-sort={metric === 'tokens' ? 'descending' : undefined}>Tokens</th><th aria-sort={metric === 'requests' ? 'descending' : undefined}>{t('Requests')}</th><th>{t('Model preferences')}</th></tr></thead>
            <tbody>{data.users.map((user) => <tr key={user.rank} data-me={user.is_me || undefined}>
              <th scope='row'><div className='leaderboard-member'><RankBadge rank={user.rank} /><div className='leaderboard-username'><span>{user.username === 'Anonymous member' ? t('Anonymous member') : user.username}</span>{user.is_me && <small>{t('You')}</small>}</div></div></th>
              <td className='leaderboard-tokens' title={full(user.tokens)}><span className='leaderboard-mobile-label'>Tokens</span><strong>{compact(user.tokens)}</strong></td>
              <td className='leaderboard-requests' title={full(user.requests)}><span className='leaderboard-mobile-label'>{t('Requests')}</span>{compact(user.requests)}</td>
              <td className='leaderboard-preferences'><div>{user.preferences.map((model) => <span className='leaderboard-model-tag' key={model.model_name} title={`${model.model_name || t('Other models')} · ${percent(model.share)}`}><ModelIcon name={model.model_name} /><span className='leaderboard-model-name'>{model.model_name || t('Other models')}</span><small>{percent(model.share)}</small></span>)}</div></td>
            </tr>)}</tbody>
          </table>}
        </section>
        <section className='leaderboard-panel leaderboard-models' aria-labelledby='leaderboard-models-title'>
          <div className='leaderboard-section-heading'><h2 id='leaderboard-models-title'>{t('Popular models')}</h2><span>{t('Request share')}</span></div>
          <p className='leaderboard-models-description'>{t('Model preferences are based on successful requests.')}</p>
          {!data.models.length ? <EmptyState icon={Zap} iconVariant='plain' title={t('No usage in this period')} /> : <ol className='leaderboard-model-list'>{data.models.map((model, index) => <li key={model.model_name}>
            <div className='leaderboard-model-label'><span className='leaderboard-model-position'>{index + 1}</span><ModelIcon name={model.model_name} size={18} /><strong title={model.model_name || t('Other models')}>{model.model_name || t('Other models')}</strong><span>{percent(model.share)}</span></div>
            <div className='leaderboard-model-track' aria-hidden='true'><div style={{ width: `${model.share * 100}%` }} /></div>
            <div className='leaderboard-model-detail'><span>{t('{{count}} requests', { count: model.requests })}</span><span title={full(model.tokens)}>{compact(model.tokens)} Tokens</span></div>
          </li>)}</ol>}
        </section>
      </div>
    </div>}
  </div>;
}

import { useId } from 'react';
import { useTranslation } from 'react-i18next';

const awards = [
  { label: 'Champion', light: '#fff1b7', color: '#e9b648', dark: '#a66b13', ribbon: '#d5a13a' },
  { label: 'Runner-up', light: '#f1f5fa', color: '#b8c7d9', dark: '#687e99', ribbon: '#91a6c1' },
  { label: 'Third place', light: '#ffe6d3', color: '#d99a70', dark: '#9a5f3c', ribbon: '#bb7d55' },
];

export default function RankBadge({ rank }: { rank: number }) {
  const { t } = useTranslation();
  const gradientId = useId();
  const award = awards[rank - 1];

  if (!award) return <span className='leaderboard-rank'>{rank}</span>;

  return <span className='leaderboard-rank'>
    <svg className='leaderboard-podium-icon' width='34' height='38' viewBox='0 0 40 44' role='img' aria-label={`${t(award.label)} · ${rank}`}>
      <defs><linearGradient id={gradientId} x1='8' y1='9' x2='32' y2='35' gradientUnits='userSpaceOnUse'><stop stopColor={award.light} /><stop offset='1' stopColor={award.color} /></linearGradient></defs>
      {rank === 1 ? <>
        <path d='m12 10-2-7 6 3 4-5 4 5 6-3-2 7Z' fill={award.color} stroke={award.dark} strokeWidth='.8' strokeLinejoin='round' />
        <path d='M7 19c-5 5-3 14 4 17M5 24l4 2m-3 3 4 1m-2 4 4-1m21-14c5 5 3 14-4 17m6-12-4 2m3 3-4 1m2 4-4-1' fill='none' stroke={award.ribbon} strokeWidth='1.6' strokeLinecap='round' />
        <path d='M10 13h20v12c0 8-10 14-10 14S10 33 10 25Z' fill={`url(#${gradientId})`} stroke={award.dark} strokeWidth='1' />
        <path d='M13 16h14v9c0 5-7 10-7 10s-7-5-7-10Z' fill='none' stroke='white' strokeOpacity='.55' />
      </> : <>
        <path d='m11 27-3 14 7-3 4 5 3-14m-1 0 4 14 4-5 7 3-5-14' fill={award.ribbon} stroke={award.dark} strokeWidth='.7' strokeLinejoin='round' />
        {rank === 2
          ? <circle cx='20' cy='20' r='14' fill={`url(#${gradientId})`} stroke={award.dark} strokeWidth='1' />
          : <path d='m20 5 6 3 6 2 2 6 1 6-4 5-4 5-7 2-7-2-4-5-4-5 1-6 2-6 6-2Z' fill={`url(#${gradientId})`} stroke={award.dark} strokeWidth='1' strokeLinejoin='round' />}
        <circle cx='20' cy='20' r='10.5' fill='none' stroke='white' strokeOpacity='.6' />
      </>}
      <g fill='none' stroke={award.dark} strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
        {rank === 1 ? <path d='m17 21 3-3v12m-3 0h6' /> : rank === 2 ? <path d='M16 17a4 4 0 0 1 8 0c0 3-8 5-8 9h8' /> : <path d='M16 15.5c4-3 8-1 8 2 0 2-2 3-4 3 2 0 4 1 4 3 0 3-4 5-8 2' />}
      </g>
    </svg>
  </span>;
}

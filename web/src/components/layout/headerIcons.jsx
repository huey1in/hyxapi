import React from 'react';

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const BellIcon = ({ size = 18, ...p }) => (
  <svg width={size} height={size} viewBox='0 0 20 20' strokeWidth='1.5' {...base} {...p}>
    <path d='M10 2.5a1 1 0 0 1 1 1A4.5 4.5 0 0 1 14.5 8v3l1.2 1.8H4.3L5.5 11V8A4.5 4.5 0 0 1 9 3.5a1 1 0 0 1 1-1z' />
    <path d='M8.5 15.5a1.5 1.5 0 0 0 3 0' />
  </svg>
);

export const GlobeIcon = ({ size = 18, ...p }) => (
  <svg width={size} height={size} viewBox='0 0 20 20' strokeWidth='1.5' {...base} {...p}>
    <circle cx='10' cy='10' r='7.5' />
    <ellipse cx='10' cy='10' rx='3' ry='7.5' />
    <line x1='2.5' y1='10' x2='17.5' y2='10' />
  </svg>
);

export const SunIcon = ({ size = 18, ...p }) => (
  <svg width={size} height={size} viewBox='0 0 20 20' strokeWidth='1.5' fill='none' stroke='currentColor' strokeLinecap='round' {...p}>
    <circle cx='10' cy='10' r='3.25' />
    <line x1='10' y1='2'  x2='10' y2='4'  />
    <line x1='10' y1='16' x2='10' y2='18' />
    <line x1='2'  y1='10' x2='4'  y2='10' />
    <line x1='16' y1='10' x2='18' y2='10' />
    <line x1='4.64'  y1='4.64'  x2='6.05'  y2='6.05'  />
    <line x1='13.95' y1='13.95' x2='15.36' y2='15.36' />
    <line x1='13.95' y1='6.05'  x2='15.36' y2='4.64'  />
    <line x1='4.64'  y1='15.36' x2='6.05'  y2='13.95' />
  </svg>
);

export const MoonIcon = ({ size = 18, ...p }) => (
  <svg width={size} height={size} viewBox='0 0 20 20' strokeWidth='1.5' {...base} {...p}>
    <path d='M15.5 11A7 7 0 0 1 7.5 3a7 7 0 1 0 8 8z' />
  </svg>
);

export const ChevronDownIcon = ({ size = 14, ...p }) => (
  <svg width={size} height={size} viewBox='0 0 20 20' strokeWidth='1.75' {...base} {...p}>
    <path d='M5 8l5 5 5-5' />
  </svg>
);

export const WalletIcon = ({ size = 15, ...p }) => (
  <svg width={size} height={size} viewBox='0 0 20 20' strokeWidth='1.5' {...base} {...p}>
    <rect x='2' y='5' width='16' height='12' rx='2' />
    <path d='M2 8h16' />
    <path d='M13 13.5h.01' strokeWidth='2' />
  </svg>
);

export const LogOutIcon = ({ size = 15, ...p }) => (
  <svg width={size} height={size} viewBox='0 0 20 20' strokeWidth='1.5' {...base} {...p}>
    <path d='M8 3H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4' />
    <path d='M13 14l4-4-4-4' />
    <line x1='17' y1='10' x2='7' y2='10' />
  </svg>
);

export const MonitorIcon = ({ size = 15, ...p }) => (
  <svg width={size} height={size} viewBox='0 0 20 20' strokeWidth='1.5' {...base} {...p}>
    <rect x='2' y='3' width='16' height='11' rx='2' />
    <path d='M7 18h6' />
    <path d='M10 14v4' />
  </svg>
);

export const SlidersIcon = ({ size = 15, ...p }) => (
  <svg width={size} height={size} viewBox='0 0 20 20' strokeWidth='1.5' fill='none' stroke='currentColor' strokeLinecap='round' {...p}>
    <line x1='3' y1='5' x2='5.25' y2='5' />
    <circle cx='7' cy='5' r='1.75' />
    <line x1='8.75' y1='5' x2='17' y2='5' />
    <line x1='3' y1='10' x2='11.25' y2='10' />
    <circle cx='13' cy='10' r='1.75' />
    <line x1='14.75' y1='10' x2='17' y2='10' />
    <line x1='3' y1='15' x2='7.25' y2='15' />
    <circle cx='9' cy='15' r='1.75' />
    <line x1='10.75' y1='15' x2='17' y2='15' />
  </svg>
);

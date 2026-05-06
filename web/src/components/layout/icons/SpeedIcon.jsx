import React from 'react';

/* 测速：仪表盘指针 */
const SpeedIcon = ({ size = 14, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M3 14.5a7 7 0 1 1 14 0" />
    <path d="M10 14.5l3-4.5" />
    <circle cx="10" cy="14.5" r="0.75" fill="currentColor" stroke="none" />
  </svg>
);

export default SpeedIcon;

import React from 'react';

const MonitorIcon = ({ size = 18, ...props }) => (
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
    <rect x="2" y="3" width="16" height="11" rx="2" />
    <path d="M7 18h6" />
    <path d="M10 14v4" />
  </svg>
);

export default MonitorIcon;

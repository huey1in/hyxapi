import React from 'react';

const SunIcon = ({ size = 18, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    {...props}
  >
    <circle cx="10" cy="10" r="3.25" />
    <line x1="10" y1="2" x2="10" y2="4" />
    <line x1="10" y1="16" x2="10" y2="18" />
    <line x1="2" y1="10" x2="4" y2="10" />
    <line x1="16" y1="10" x2="18" y2="10" />
    <line x1="4.64" y1="4.64" x2="6.05" y2="6.05" />
    <line x1="13.95" y1="13.95" x2="15.36" y2="15.36" />
    <line x1="13.95" y1="6.05" x2="15.36" y2="4.64" />
    <line x1="4.64" y1="15.36" x2="6.05" y2="13.95" />
  </svg>
);

export default SunIcon;

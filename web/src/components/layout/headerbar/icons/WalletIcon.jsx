import React from 'react';

const WalletIcon = ({ size = 15, ...props }) => (
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
    <rect x="2" y="5" width="16" height="12" rx="2" />
    <path d="M2 8h16" />
    <path d="M13 13.5h.01" strokeWidth="2" />
  </svg>
);

export default WalletIcon;

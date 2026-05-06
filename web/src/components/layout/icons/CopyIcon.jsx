import React from 'react';

const CopyIcon = ({ size = 14, ...props }) => (
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
    <rect x="6.5" y="6.5" width="10" height="10" rx="1.75" />
    <path d="M3.5 13V4.5A1 1 0 0 1 4.5 3.5H13" />
  </svg>
);

export default CopyIcon;

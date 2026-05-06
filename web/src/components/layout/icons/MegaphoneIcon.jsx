import React from 'react';

const MegaphoneIcon = ({ size = 18, ...props }) => (
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
    <path d="M3 8h3.5L15 4v12L6.5 12H3a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
    <path d="M6.5 12v3.5a1.5 1.5 0 0 0 3 0V13" />
    <path d="M17 6.5a3 3 0 0 1 0 7" />
  </svg>
);

export default MegaphoneIcon;

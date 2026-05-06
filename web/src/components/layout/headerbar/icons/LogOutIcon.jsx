import React from 'react';

const LogOutIcon = ({ size = 15, ...props }) => (
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
    <path d="M8 3H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4" />
    <path d="M13 14l4-4-4-4" />
    <line x1="17" y1="10" x2="7" y2="10" />
  </svg>
);

export default LogOutIcon;

import React from 'react';

const BellIcon = ({ size = 18, ...props }) => (
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
    <path d="M10 2.5a1 1 0 0 1 1 1A4.5 4.5 0 0 1 14.5 8v3l1.2 1.8H4.3L5.5 11V8A4.5 4.5 0 0 1 9 3.5a1 1 0 0 1 1-1z" />
    <path d="M8.5 15.5a1.5 1.5 0 0 0 3 0" />
  </svg>
);

export default BellIcon;

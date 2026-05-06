import React from 'react';

const KeyIcon = ({ size = 15, ...props }) => (
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
    <circle cx="7.5" cy="9" r="4" />
    <path d="M11.5 9H17" />
    <path d="M15.5 9v2" />
    <path d="M13.5 9v1.5" />
  </svg>
);

export default KeyIcon;

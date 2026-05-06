import React from 'react';

const MoonIcon = ({ size = 18, ...props }) => (
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
    <path d="M15.5 11A7 7 0 0 1 7.5 3a7 7 0 1 0 8 8z" />
  </svg>
);

export default MoonIcon;

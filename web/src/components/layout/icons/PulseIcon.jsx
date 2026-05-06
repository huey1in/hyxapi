import React from 'react';

const PulseIcon = ({ size = 18, ...props }) => (
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
    <path d="M2 10h3l2-5 3 10 2.5-7 1.5 4h4" />
  </svg>
);

export default PulseIcon;

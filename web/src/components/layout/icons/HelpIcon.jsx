import React from 'react';

const HelpIcon = ({ size = 18, ...props }) => (
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
    <circle cx="10" cy="10" r="7.5" />
    <path d="M7.5 7.5a2.5 2.5 0 0 1 4.85.83c0 1.67-2.5 2.5-2.5 2.5" />
    <line x1="10" y1="13.75" x2="10" y2="13.76" strokeWidth="2" />
  </svg>
);

export default HelpIcon;

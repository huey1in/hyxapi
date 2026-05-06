import React from 'react';

const GlobeIcon = ({ size = 18, ...props }) => (
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
    <ellipse cx="10" cy="10" rx="3" ry="7.5" />
    <line x1="2.5" y1="10" x2="17.5" y2="10" />
  </svg>
);

export default GlobeIcon;

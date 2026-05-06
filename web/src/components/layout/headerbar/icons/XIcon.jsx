import React from 'react';

const XIcon = ({ size = 20, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    {...props}
  >
    <path d="M4 4l12 12M16 4L4 16" />
  </svg>
);

export default XIcon;

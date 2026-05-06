import React from 'react';

const InboxEmptyIcon = ({ size = 28, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 28 28"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {/* Tray body */}
    <path d="M4 17L7.5 7h13L24 17" />
    <rect x="4" y="17" width="20" height="7" rx="2" />
    {/* Slot ridge */}
    <path d="M4 17h5.5a1.5 1.5 0 0 1 1.5 1.5h6A1.5 1.5 0 0 1 18.5 17H24" />
    {/* Three small dashes inside tray suggesting emptiness */}
    <line x1="10" y1="11.5" x2="18" y2="11.5" strokeWidth="1.25" strokeOpacity="0.5" />
    <line x1="11.5" y1="14" x2="16.5" y2="14" strokeWidth="1.25" strokeOpacity="0.35" />
  </svg>
);

export default InboxEmptyIcon;

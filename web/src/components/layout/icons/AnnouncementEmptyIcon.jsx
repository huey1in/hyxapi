import React from 'react';

/* 系统公告空状态 — 哑火的扩音器：喇叭形状 + 虚线消散的声波，暗示"广播但无内容" */
const AnnouncementEmptyIcon = ({ size = 28, ...props }) => (
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
    {/* Megaphone body + horn */}
    <path d="M4 11h5L21 5v18L9 17H4V11z" />
    {/* Muted wave — inner */}
    <path
      d="M23 11c0.7 0.9 1.1 2.2 1.1 3.5s-0.4 2.6-1.1 3.5"
      strokeDasharray="1.8 1.5"
      opacity="0.4"
    />
    {/* Muted wave — outer */}
    <path
      d="M25.5 9c1.1 1.5 1.75 3.4 1.75 5.5s-0.65 4-1.75 5.5"
      strokeDasharray="1.8 1.5"
      opacity="0.18"
    />
  </svg>
);

export default AnnouncementEmptyIcon;

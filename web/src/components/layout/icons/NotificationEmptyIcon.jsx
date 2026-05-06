import React from 'react';

/* 通知空状态 — 静默信号：渐淡的弧线 + 中心点，暗示"无信号/没有消息" */
const NotificationEmptyIcon = ({ size = 28, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 28 28"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    {...props}
  >
    {/* Center dot */}
    <circle cx="14" cy="21" r="1.75" fill="currentColor" stroke="none" />
    {/* Inner arc */}
    <path d="M9.5 17a6.5 6.5 0 0 1 9 0" strokeWidth="1.5" opacity="0.35" />
    {/* Middle arc */}
    <path d="M6 13.5a11.5 11.5 0 0 1 16 0" strokeWidth="1.5" opacity="0.18" />
    {/* Outer arc */}
    <path d="M2.5 10a18 18 0 0 1 23 0" strokeWidth="1.5" opacity="0.07" />
  </svg>
);

export default NotificationEmptyIcon;

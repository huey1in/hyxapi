import React from 'react';

/* Three horizontal rails with split circle knobs — proper sliders look */
const SlidersIcon = ({ size = 15, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    {...props}
  >
    {/* Rail 1 — knob at x=7 */}
    <line x1="3" y1="5" x2="5.25" y2="5" />
    <circle cx="7" cy="5" r="1.75" />
    <line x1="8.75" y1="5" x2="17" y2="5" />

    {/* Rail 2 — knob at x=13 */}
    <line x1="3" y1="10" x2="11.25" y2="10" />
    <circle cx="13" cy="10" r="1.75" />
    <line x1="14.75" y1="10" x2="17" y2="10" />

    {/* Rail 3 — knob at x=9 */}
    <line x1="3" y1="15" x2="7.25" y2="15" />
    <circle cx="9" cy="15" r="1.75" />
    <line x1="10.75" y1="15" x2="17" y2="15" />
  </svg>
);

export default SlidersIcon;

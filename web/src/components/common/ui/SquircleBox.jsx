/*
 * SquircleBox — Apple/Figma-style continuous corner container.
 *
 * Each corner is a cubic-bezier curve whose control points sit at
 * `cornerRadius * (1 + smoothing)` along the edges. This produces the
 * smooth-corner / squircle look popularised by iOS, instead of the
 * quadratic arc that `border-radius` draws.
 *
 * The path is rendered through `mask-image` so the layout box gets the
 * exact superellipse silhouette, and a separate SVG overlay paints the
 * border along the same path so it follows the curvature.
 */
import React, { useEffect, useRef, useState } from 'react';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function buildSquirclePath(w, h, cornerRadius, smoothing) {
  const r = clamp(cornerRadius, 0, Math.min(w, h) / 2);
  const s = clamp(smoothing, 0, 1);
  // distance the curve extends along the straight edge before curving
  const e = r * (1 + s);
  // bezier control offset perpendicular to the edge
  const c = r * (1 - s) * 0.45;

  return [
    `M ${e} 0`,
    `L ${w - e} 0`,
    `C ${w - c} 0 ${w} ${c} ${w} ${e}`,
    `L ${w} ${h - e}`,
    `C ${w} ${h - c} ${w - c} ${h} ${w - e} ${h}`,
    `L ${e} ${h}`,
    `C ${c} ${h} 0 ${h - c} 0 ${h - e}`,
    `L 0 ${e}`,
    `C 0 ${c} ${c} 0 ${e} 0`,
    'Z',
  ].join(' ');
}

const SquircleBox = ({
  radius = 28,
  smoothing = 0.6,
  background = 'var(--page-bg)',
  border = 'var(--ui-border)',
  borderWidth = 1,
  className = '',
  style = {},
  children,
}) => {
  const ref = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!ref.current) return;
    const update = () => {
      const rect = ref.current.getBoundingClientRect();
      setSize({ w: Math.round(rect.width), h: Math.round(rect.height) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const { w, h } = size;
  const ready = w > 0 && h > 0;
  const path = ready ? buildSquirclePath(w, h, radius, smoothing) : '';
  const svg = ready
    ? `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}' preserveAspectRatio='none'><path d='${path}' fill='black'/></svg>`
    : '';
  const maskUrl = svg
    ? `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`
    : 'none';

  return (
    <div ref={ref} className={`relative ${className}`} style={style}>
      <div
        aria-hidden
        className='absolute inset-0 pointer-events-none'
        style={{
          backgroundColor: background,
          WebkitMaskImage: maskUrl,
          maskImage: maskUrl,
          WebkitMaskSize: '100% 100%',
          maskSize: '100% 100%',
        }}
      />
      {ready && border && (
        <svg
          aria-hidden
          className='absolute inset-0 pointer-events-none'
          width='100%'
          height='100%'
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio='none'
        >
          <path
            d={path}
            fill='none'
            stroke={border}
            strokeWidth={borderWidth}
            vectorEffect='non-scaling-stroke'
          />
        </svg>
      )}
      <div className='relative'>{children}</div>
    </div>
  );
};

export default SquircleBox;

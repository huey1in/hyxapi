/*
 * VChart theme helpers — read CSS vars at runtime so charts follow theme.
 *
 * Usage:
 *   import { applyTheme, brandPalette, sparkSpec } from './vchartTheme';
 *   const themed = applyTheme(spec);
 */

const readVar = (name, fallback = '') => {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
};

const hexToRgb = (hex) => {
  if (!hex || !hex.startsWith('#')) return [59, 130, 246];
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const tokens = () => {
  const brand = readVar('--ui-brand', '#3b82f6');
  const border = readVar('--ui-border', '#e5e7eb');
  const text = readVar('--ui-text', '#0a0a0a');
  const text2 = readVar('--ui-text-2', '#737373');
  const text3 = readVar('--ui-text-3', '#a3a3a3');
  const bgEl = readVar('--ui-bg-elevated', '#ffffff');
  const [r, g, b] = hexToRgb(brand);
  return {
    brand,
    brandRgb: `${r}, ${g}, ${b}`,
    border,
    text,
    text2,
    text3,
    bgEl,
  };
};

/** Multi-series color palette derived from brand color. */
export const brandPalette = (count = 6) => {
  const { brandRgb } = tokens();
  const stops = [1, 0.7, 0.5, 0.4, 0.3, 0.22, 0.18, 0.14];
  return stops.slice(0, Math.max(count, 1)).map((a) => `rgba(${brandRgb}, ${a})`);
};

/** Apply our visual conventions on top of a vchart spec. */
export const applyTheme = (spec) => {
  if (!spec) return spec;
  const t = tokens();

  const labelStyle = { fontSize: 11, fill: t.text3 };
  const tickStyle = { stroke: t.border };
  const axisLineStyle = { stroke: t.border };
  const gridStyle = { stroke: t.border, lineDash: [3, 3] };

  const axisOverride = (orient) => ({
    domainLine: { visible: true, style: axisLineStyle },
    tick: { visible: false, style: tickStyle },
    label: { style: labelStyle },
    grid: orient === 'left'
      ? { visible: true, style: gridStyle }
      : { visible: false },
  });

  const legendOverride = {
    orient: 'bottom',
    item: {
      label: { style: { fontSize: 11, fill: t.text2 } },
      shape: { style: { size: 8 } },
    },
  };

  const tooltipOverride = {
    style: {
      panel: {
        backgroundColor: t.bgEl,
        border: { color: t.border, width: 1, dash: [], radius: 8 },
        shadow: { x: 0, y: 0, blur: 0, spread: 0 },
      },
      titleLabel: { fontSize: 12, fontColor: t.text, fontWeight: 600 },
      keyLabel: { fontSize: 11, fontColor: t.text2 },
      valueLabel: { fontSize: 11, fontColor: t.text },
    },
  };

  // axes patching
  let axes = spec.axes;
  if (Array.isArray(axes)) {
    axes = axes.map((ax) => ({
      ...ax,
      ...axisOverride(ax.orient),
    }));
  }

  // bar chart: rounded corners + thinner bars
  let bar = spec.bar;
  if (spec.type === 'bar' || spec.type === 'common') {
    bar = {
      ...(spec.bar || {}),
      style: { cornerRadius: 4, ...((spec.bar && spec.bar.style) || {}) },
    };
  }

  // line: thinner, no points
  let line = spec.line;
  if (spec.type === 'line' || spec.type === 'common') {
    line = {
      ...(spec.line || {}),
      style: { lineWidth: 1.5, ...((spec.line && spec.line.style) || {}) },
    };
  }

  // pie: donut + brand palette
  const isPie = spec.type === 'pie';

  const colorOverride = isPie
    ? brandPalette((spec.data?.[0]?.values?.length) || 6)
    : brandPalette(6);

  const out = {
    ...spec,
    color: { type: 'ordinal', range: colorOverride },
    axes,
    legends: spec.legends === false || spec.legends?.visible === false
      ? spec.legends
      : { ...legendOverride, ...(spec.legends || {}) },
    tooltip: spec.tooltip === false || spec.tooltip?.visible === false
      ? spec.tooltip
      : { ...(spec.tooltip || {}), ...tooltipOverride },
    bar,
    line,
    point: spec.point === false ? spec.point : { ...(spec.point || {}), visible: false },
    background: { fill: 'transparent' },
  };

  if (isPie) {
    out.innerRadius = 0.65;
    out.outerRadius = 0.95;
  }

  return out;
};

/** Lightweight sparkline spec for KPI cards. */
export const sparkSpec = (data, colorOverride) => {
  const t = tokens();
  const color = colorOverride || t.brand;
  const values = (data || []).map((v, i) => ({ x: i, y: v }));
  return {
    type: 'common',
    data: [{ id: 'spark', values }],
    series: [
      {
        type: 'area',
        xField: 'x',
        yField: 'y',
        area: {
          style: {
            fill: {
              gradient: 'linear',
              x0: 0, y0: 0, x1: 0, y1: 1,
              stops: [
                { offset: 0, color, opacity: 0.18 },
                { offset: 1, color, opacity: 0 },
              ],
            },
          },
        },
        line: { style: { stroke: color, lineWidth: 1.5 } },
        point: { visible: false },
      },
    ],
    axes: [
      { orient: 'bottom', visible: false },
      { orient: 'left', visible: false },
    ],
    padding: 0,
    autoFit: true,
    legends: { visible: false },
    tooltip: { visible: false },
    crosshair: { visible: false },
    background: { fill: 'transparent' },
  };
};

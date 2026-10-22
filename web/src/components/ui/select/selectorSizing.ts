import type { CSSProperties } from 'react';

export const SELECTOR_MAX_WIDTH = 320;

// Legacy width values now set an upper bound; selectors always fit their content.
export function selectorStyle(width?: CSSProperties['width'] | 'full'): CSSProperties {
  const limit = typeof width === 'number' ? `${width}px` : width;
  const bounded = limit && !['full', 'auto', 'fit-content', 'min-content', 'max-content'].includes(limit);
  return {
    width: 'fit-content',
    minWidth: 0,
    maxWidth: `min(100%, ${SELECTOR_MAX_WIDTH}px${bounded ? `, ${limit}` : ''})`,
  };
}

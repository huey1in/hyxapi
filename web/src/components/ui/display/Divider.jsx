/*
 * Divider — 分隔线
 *
 * orientation: horizontal (默认) | vertical
 * spacing:     sm | md (默认) | lg
 */

import { cn } from '../tokens';

const SPACING_H = { sm: 'my-2', md: 'my-4', lg: 'my-6' };
const SPACING_V = { sm: 'mx-2', md: 'mx-4', lg: 'mx-6' };

const Divider = ({ orientation = 'horizontal', spacing = 'md' }) => {
  if (orientation === 'vertical') {
    return <span aria-hidden className={cn('inline-block w-px h-4 bg-ui-divider', SPACING_V[spacing])} />;
  }
  return <div aria-hidden className={cn('w-full h-px bg-ui-divider', SPACING_H[spacing])} />;
};

export default Divider;

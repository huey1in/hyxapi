/*
 * Tooltip — hover 显示文字提示
 *
 * placement: top (默认) | bottom | left | right
 * children:  必须是单一可获得 hover 事件的元素（按钮、图标等）
 */

import { useState } from 'react';
import { cn } from '../tokens';

const PLACE = {
  top:    'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
  left:   'right-full top-1/2 -translate-y-1/2 mr-1.5',
  right:  'left-full top-1/2 -translate-y-1/2 ml-1.5',
};

const Tooltip = ({ content, placement = 'top', children }) => {
  const [show, setShow] = useState(false);
  return (
    <span
      className='relative inline-flex'
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show && content && (
        <span
          role='tooltip'
          className={cn(
            'absolute z-50 px-2 py-1 text-[11px] font-medium whitespace-nowrap rounded-md',
            'bg-ui-accent text-ui-accent-fg shadow-lg pointer-events-none',
            PLACE[placement],
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
};

export default Tooltip;

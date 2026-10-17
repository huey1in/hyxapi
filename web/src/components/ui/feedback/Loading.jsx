/*
 * Loading — 旋转 spinner
 *
 * size:       xs | sm | md (默认) | lg
 * fullscreen: 居中全屏覆盖
 * label:      下方文字
 */

import { Loader2 } from 'lucide-react';

const ICON_SIZE = { xs: 14, sm: 18, md: 24, lg: 32 };

const Loading = ({ size = 'md', fullscreen = false, label }) => {
  const inner = (
    <div className='flex flex-col items-center gap-2 text-ui-text-3'>
      <Loader2 size={ICON_SIZE[size]} className='animate-spin' />
      {label && <span className='text-xs'>{label}</span>}
    </div>
  );
  if (fullscreen) {
    return (
      <div className='fixed inset-0 z-[150] flex items-center justify-center bg-black/30 backdrop-blur-xs'>
        {inner}
      </div>
    );
  }
  return inner;
};

export default Loading;

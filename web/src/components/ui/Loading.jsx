/*
 * Loading — 统一加载状态
 *
 * 使用：
 *   <Loading />                    // 默认中等尺寸
 *   <Loading size='sm' />          // 内联小型
 *   <Loading text='加载中...' />   // 带文字
 *   <Loading fullscreen />         // 全屏遮罩
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './tokens';

const SIZE = { sm: 14, md: 18, lg: 24 };

const Loading = ({ size = 'md', text, fullscreen = false, className }) => {
  const inner = (
    <span className={cn('inline-flex items-center gap-2 text-ui-text-3', className)}>
      <Loader2 size={SIZE[size]} className='animate-spin' />
      {text && <span className='text-sm'>{text}</span>}
    </span>
  );

  if (fullscreen) {
    return (
      <div className='fixed inset-0 z-[200] flex items-center justify-center bg-ui-bg/60 backdrop-blur-sm'>
        {inner}
      </div>
    );
  }

  return inner;
};

export default Loading;

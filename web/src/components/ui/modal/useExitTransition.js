/* useExitTransition — 处理弹出层的进入 / 退出动画
 *
 * open 为 false 时延迟卸载，期间 exiting=true，组件可切到 out 动画类。
 *
 *   const { mounted, exiting } = useExitTransition(open, 220);
 *   if (!mounted) return null;
 *   <div className={exiting ? 'animate-overlay-out' : 'animate-overlay-in'} />
 */
import { useEffect, useRef, useState } from 'react';

export default function useExitTransition(open, duration = 220) {
  const [mounted, setMounted] = useState(open);
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (open) {
      setMounted(true);
      setExiting(false);
    } else if (mounted) {
      setExiting(true);
      timerRef.current = setTimeout(() => {
        setMounted(false);
        setExiting(false);
      }, duration);
    }
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return { mounted, exiting };
}

import { useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

const STORAGE_KEY = 'home-scroll-position';

function reloadPosition(pathname: string): number {
  try {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (pathname !== '/' || navigation?.type !== 'reload') return 0;
    const position = Number(sessionStorage.getItem(STORAGE_KEY));
    return Number.isFinite(position) && position > 0 ? position : 0;
  } catch { return 0; }
}

export function useHomeScrollRestoration(mainRef: RefObject<HTMLElement | null>, pathname: string) {
  const [initialPosition] = useState(() => reloadPosition(pathname));
  const pendingPosition = useRef(initialPosition);

  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    if (pathname !== '/') pendingPosition.current = 0;

    let frame = 0;
    let observer: ResizeObserver | undefined;
    const stopWatching = () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) main.removeEventListener(event, cancelRestoration);
    };
    const cancelRestoration = () => {
      pendingPosition.current = 0;
      stopWatching();
    };
    const restore = () => {
      frame = 0;
      const position = pendingPosition.current;
      if (!position) return;
      main.scrollTop = position;
      if (Math.abs(main.scrollTop - position) <= 1) cancelRestoration();
    };

    if (pendingPosition.current) {
      // The lazy route initially renders a short fallback. Retry as its content grows.
      observer = new ResizeObserver(() => {
        if (!frame) frame = requestAnimationFrame(restore);
      });
      observer.observe(main);
      if (main.firstElementChild) observer.observe(main.firstElementChild);
      for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) main.addEventListener(event, cancelRestoration, { passive: true });
      restore();
    } else {
      main.scrollTop = 0;
    }

    const savePosition = () => {
      if (pathname !== '/') return;
      try { sessionStorage.setItem(STORAGE_KEY, String(pendingPosition.current || main.scrollTop)); } catch { /* Storage may be unavailable. */ }
    };
    window.addEventListener('pagehide', savePosition);
    return () => {
      stopWatching();
      window.removeEventListener('pagehide', savePosition);
    };
  }, [mainRef, pathname]);
}

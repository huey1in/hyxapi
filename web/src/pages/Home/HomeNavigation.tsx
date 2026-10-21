import { useLayoutEffect, useRef } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';

export default function HomeNavigation({ children }: { children: ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLElement | null>(null);
  const previewRef = useRef<HTMLElement | null>(null);

  const moveIndicator = (item: HTMLElement | null) => {
    const track = trackRef.current;
    if (!track || !item) return;
    track.style.setProperty('--nav-slide-x', `${item.offsetLeft}px`);
    track.style.setProperty('--nav-slide-y', `${item.offsetTop}px`);
    track.style.setProperty('--nav-slide-width', `${item.offsetWidth}px`);
    track.style.setProperty('--nav-slide-height', `${item.offsetHeight}px`);
    track.dataset.ready = 'true';
  };

  const eventLink = (event: SyntheticEvent) => {
    const item = event.target instanceof Element ? event.target.closest<HTMLElement>('a,button') : null;
    return item?.parentElement === trackRef.current ? item : null;
  };

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const links = [...track.querySelectorAll<HTMLElement>(':scope > a,:scope > button')];
    if (!selectedRef.current || !links.includes(selectedRef.current)) selectedRef.current = links[0] ?? null;
    if (previewRef.current && !links.includes(previewRef.current)) previewRef.current = null;
    const update = () => moveIndicator(previewRef.current ?? selectedRef.current);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(track);
    links.forEach((link) => observer.observe(link));
    return () => observer.disconnect();
  }, [children]);

  const preview = (event: SyntheticEvent) => {
    const item = eventLink(event);
    if (!item) return;
    previewRef.current = item;
    moveIndicator(item);
  };

  const dock = () => {
    const focused = document.activeElement;
    previewRef.current = focused instanceof HTMLElement && focused.parentElement === trackRef.current ? focused : null;
    moveIndicator(previewRef.current ?? selectedRef.current);
  };

  return <div
    ref={trackRef}
    className='home-nav-track'
    onPointerOver={preview}
    onPointerLeave={dock}
    onFocusCapture={preview}
    onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) dock(); }}
    onClickCapture={(event) => {
      const item = eventLink(event);
      if (item) { selectedRef.current = item; moveIndicator(item); }
    }}
  >
    <span className='home-nav-slider' aria-hidden='true' />
    {children}
  </div>;
}

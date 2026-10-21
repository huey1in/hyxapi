import { useLayoutEffect, useRef } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';
import { useLocation } from 'react-router-dom';

export default function PublicNavigation({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const trackRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLElement | null>(null);

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
    const current = links.find((link) => link.getAttribute('aria-current') === 'page');
    if (current) selectedRef.current = current;
    else if (!selectedRef.current || !links.includes(selectedRef.current)) selectedRef.current = links[0] ?? null;
    const update = () => moveIndicator(selectedRef.current);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(track);
    links.forEach((link) => observer.observe(link));
    return () => observer.disconnect();
  }, [children, pathname]);

  return <div
    ref={trackRef}
    className='home-nav-track'
    onClickCapture={(event) => {
      const item = eventLink(event);
      if (item) { selectedRef.current = item; moveIndicator(item); }
    }}
  >
    <span className='home-nav-slider' aria-hidden='true' />
    {children}
  </div>;
}

import { useLayoutEffect } from 'react';
import type { RefObject } from 'react';
import { SELECTOR_MAX_WIDTH } from './selectorSizing';

type Options = {
  open: boolean;
  popover?: boolean;
  trigger: RefObject<HTMLButtonElement | null>;
  menu: RefObject<HTMLDivElement | null>;
  content: RefObject<HTMLDivElement | null>;
  placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
  minMenuWidth?: number;
  search?: RefObject<HTMLInputElement | null>;
};

export default function useDropdownLayout({ open, popover = true, trigger, menu, content, placement = 'bottom-start', minMenuWidth = 0, search }: Options) {
  useLayoutEffect(() => {
    const panel = menu.current, items = content.current, button = trigger.current;
    if (!open || !popover || !panel || !items || !button) return;
    panel.showPopover();
    const position = () => {
      const bounds = button.getBoundingClientRect();
      const viewport = window.visualViewport;
      const left = (viewport?.offsetLeft ?? 0) + 8;
      const top = (viewport?.offsetTop ?? 0) + 8;
      const right = left + (viewport?.width ?? innerWidth) - 16;
      const bottom = top + (viewport?.height ?? innerHeight) - 16;
      const maxWidth = Math.min(SELECTOR_MAX_WIDTH, right - left);
      panel.style.width = 'max-content';
      panel.style.minWidth = `${Math.min(maxWidth, Math.max(bounds.width, minMenuWidth))}px`;
      panel.style.maxWidth = `${maxWidth}px`;
      const width = panel.offsetWidth;
      const header = items.offsetTop;
      const height = Math.min(items.scrollHeight, 288) + header + 1;
      const above = Math.max(0, bounds.top - top - 6);
      const below = Math.max(0, bottom - bounds.bottom - 6);
      const upwards = placement.startsWith('top') ? above >= height || above > below : below < height && above > below;
      const maxHeight = Math.max(0, Math.min(288, (upwards ? above : below) - header - 1));
      items.style.maxHeight = `${maxHeight}px`;
      panel.style.left = `${Math.max(left, Math.min(placement.endsWith('end') ? bounds.right - width : bounds.left, right - width))}px`;
      panel.style.top = `${upwards ? bounds.top - 6 - Math.min(items.scrollHeight, maxHeight) - header - 1 : bounds.bottom + 6}px`;
    };
    position();
    search?.current?.focus({ preventScroll: true });
    const observer = new ResizeObserver(position);
    observer.observe(button);
    observer.observe(panel);
    observer.observe(items);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    document.addEventListener('animationend', position, true);
    window.visualViewport?.addEventListener('resize', position);
    window.visualViewport?.addEventListener('scroll', position);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      document.removeEventListener('animationend', position, true);
      window.visualViewport?.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('scroll', position);
      if (panel.matches(':popover-open')) panel.hidePopover();
    };
  }, [open, popover, placement, minMenuWidth, trigger, menu, content, search]);
}

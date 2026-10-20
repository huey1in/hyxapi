import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';

let dismissActiveDropdown: (() => void) | undefined;

export default function useDropdownState(container: RefObject<HTMLElement | null>) {
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    dismissActiveDropdown?.();
    dismissActiveDropdown = close;

    const dismissOutside = (event: Event) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) close();
    };
    // Capture events before a dialog or another control stops propagation.
    document.addEventListener('pointerdown', dismissOutside, true);
    document.addEventListener('click', dismissOutside, true);
    document.addEventListener('focusin', dismissOutside, true);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside, true);
      document.removeEventListener('click', dismissOutside, true);
      document.removeEventListener('focusin', dismissOutside, true);
      if (dismissActiveDropdown === close) dismissActiveDropdown = undefined;
    };
  }, [open, container]);

  return [open, setOpen] as const;
}

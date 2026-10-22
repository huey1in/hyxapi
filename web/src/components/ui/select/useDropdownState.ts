import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';

let dismissActiveDropdown: (() => void) | undefined;

export default function useDropdownState(container: RefObject<HTMLElement | null>, trigger: RefObject<HTMLButtonElement | null>) {
  const [open, setOpen] = useState(false);

  // Keep accessible labels without forwarding clicks outside the selector to its button.
  // Rebind after each render because a parent can replace a label or change the trigger ID.
  useLayoutEffect(() => {
    const labels = Array.from(trigger.current?.labels ?? []);
    const preventLabelActivation = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || container.current?.contains(target)) return;
      if (target.closest('a[href], button, input, select, textarea, summary')) return;
      event.preventDefault();
    };
    labels.forEach((label) => label.addEventListener('click', preventLabelActivation));
    return () => labels.forEach((label) => label.removeEventListener('click', preventLabelActivation));
  });

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

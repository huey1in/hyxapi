import { useEffect, useEffectEvent, useRef } from 'react';

// Apply only the latest input. Unmounting cancels pending searches, and clearing
// a text search restores the unfiltered list without waiting for the delay.
export function useLiveSearch<T>(value: T, onSearch: (value: T) => void) {
  const previous = useRef(value);
  const apply = useEffectEvent(onSearch);
  useEffect(() => {
    if (Object.is(value, previous.current)) return;
    previous.current = value;
    const timer = window.setTimeout(() => apply(value), value === '' ? 0 : 250);
    return () => window.clearTimeout(timer);
  }, [value]);
}

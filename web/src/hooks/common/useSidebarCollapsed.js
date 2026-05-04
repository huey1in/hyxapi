/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import { useState, useCallback, useEffect } from 'react';

const KEY = 'default_collapse_sidebar';

// Module-level pub/sub so all hook instances stay in sync within the same tab.
const listeners = new Set();
const readInitial = () => localStorage.getItem(KEY) === 'true';
let currentValue = typeof localStorage !== 'undefined' ? readInitial() : false;

const broadcast = (next) => {
  currentValue = next;
  listeners.forEach((fn) => fn(next));
};

export const useSidebarCollapsed = () => {
  const [collapsed, setCollapsedLocal] = useState(currentValue);

  useEffect(() => {
    const fn = (next) => setCollapsedLocal(next);
    listeners.add(fn);
    // Sync to current shared value in case it changed before mount.
    if (collapsed !== currentValue) setCollapsedLocal(currentValue);
    return () => {
      listeners.delete(fn);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = useCallback(() => {
    const next = !currentValue;
    localStorage.setItem(KEY, next.toString());
    broadcast(next);
  }, []);

  const set = useCallback((value) => {
    localStorage.setItem(KEY, value.toString());
    broadcast(value);
  }, []);

  return [collapsed, toggle, set];
};

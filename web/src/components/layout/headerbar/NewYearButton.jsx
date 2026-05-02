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

import React, { useState, useRef, useEffect } from 'react';
import fireworks from 'react-fireworks';

const NewYearButton = ({ isNewYear }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!isNewYear) return null;

  const handleNewYearClick = () => {
    setOpen(false);
    fireworks.init('root', {});
    fireworks.start();
    setTimeout(() => fireworks.stop(), 3000);
  };

  return (
    <div className='relative' ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label='New Year'
        className='inline-flex items-center justify-center w-9 h-9 rounded-lg hover:bg-ui-bg-subtle active:scale-90 transition-all duration-150 text-xl'
      >
        🎉
      </button>
      {open && (
        <div className='absolute right-0 mt-2 w-48 bg-ui-bg-elevated border border-ui-border rounded-xl shadow-lg py-1 z-50 animate-dropdown'>
          <button
            onClick={handleNewYearClick}
            className='flex w-full px-3 py-2 text-sm text-ui-text hover:bg-ui-bg-subtle transition-colors'
          >
            Happy New Year!!! 🎉
          </button>
        </div>
      )}
    </div>
  );
};

export default NewYearButton;

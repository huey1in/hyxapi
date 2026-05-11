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
import { Button, IconButton } from '../../ui';

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
      <IconButton
        icon={<span className='text-xl'>🎉</span>}
        onClick={() => setOpen((o) => !o)}
        aria-label='New Year'
      />
      {open && (
        // menu popover 浮层（下拉菜单），不是数据卡片，保留手写样式
        <div className='absolute right-0 mt-2 w-48 bg-ui-bg-elevated border border-ui-border rounded-xl shadow-lg py-1 z-50 animate-dropdown'>
          <Button
            variant='ghost'
            size='sm'
            block
            onClick={handleNewYearClick}
            className='justify-start'
          >
            Happy New Year!!! 🎉
          </Button>
        </div>
      )}
    </div>
  );
};

export default NewYearButton;

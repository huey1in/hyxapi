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

import React from 'react';
import { X, Menu } from 'lucide-react';

const MobileMenuButton = ({
  isConsoleRoute,
  isMobile,
  drawerOpen,
  collapsed,
  onToggle,
  t,
}) => {
  if (!isConsoleRoute || !isMobile) return null;

  const isOpen = isMobile ? drawerOpen : collapsed;

  return (
    <button
      onClick={onToggle}
      aria-label={isOpen ? t('关闭侧边栏') : t('打开侧边栏')}
      className='inline-flex items-center justify-center w-9 h-9 rounded-lg text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle active:scale-90 transition-all duration-150'
    >
      {isOpen ? <X size={20} /> : <Menu size={20} />}
    </button>
  );
};

export default MobileMenuButton;

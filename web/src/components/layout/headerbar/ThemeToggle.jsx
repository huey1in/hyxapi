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
import SunIcon from './icons/SunIcon';
import MoonIcon from './icons/MoonIcon';

const CYCLE = ['light', 'dark'];
const ICONS = { light: SunIcon, dark: MoonIcon };

const ThemeToggle = ({ theme, onThemeToggle, t }) => {
  const handleClick = (e) => {
    const next = CYCLE[(CYCLE.indexOf(theme) + 1) % CYCLE.length];
    onThemeToggle(next, e);
  };

  const Icon = ICONS[theme] ?? SunIcon;
  const label = theme === 'light' ? t('浅色模式') : t('深色模式');

  return (
    <button
      onClick={handleClick}
      aria-label={label}
      title={label}
      className='inline-flex items-center justify-center w-11 h-11 rounded-xl text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle active:scale-90 transition-all duration-150'
    >
      <Icon size={22} />
    </button>
  );
};

export default ThemeToggle;

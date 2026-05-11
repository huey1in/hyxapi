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
import IconButton from '../../ui/IconButton';

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
    <IconButton
      icon={Icon}
      variant='ghost'
      size='md'
      onClick={handleClick}
      aria-label={label}
      title={label}
    />
  );
};

export default ThemeToggle;

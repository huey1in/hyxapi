/*
 * ThemeToggle — 亮 / 暗主题切换
 *
 * 通过 `useTheme()` 读取与切换：在 html 上加 / 移除 `dark` 类，并持久化到 localStorage('theme')。
 *
 * size: sm | md (默认) | lg
 * variant / shape: 透传给 IconButton（默认 ghost / square）
 */

import React, { useEffect, useState, useCallback } from 'react';
import IconButton from '../button/IconButton';
import { SunIcon, MoonIcon } from '../../layout/headerIcons';

const STORAGE_KEY = 'theme';

const readInitial = () => {
  if (typeof document === 'undefined') return 'light';
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const useTheme = () => {
  const [theme, setTheme] = useState(readInitial);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return { theme, setTheme, toggle, isDark: theme === 'dark' };
};

const ThemeToggle = ({ size = 'md', variant = 'ghost', shape = 'square' }) => {
  const { isDark, toggle } = useTheme();
  return (
    <IconButton
      icon={isDark ? SunIcon : MoonIcon}
      size={size}
      variant={variant}
      shape={shape}
      onClick={toggle}
      title={isDark ? '切换到亮色' : '切换到暗色'}
      aria-label='toggle theme'
    />
  );
};

export default ThemeToggle;

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

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
} from 'react';
import type { PropsWithChildren } from 'react';

type Theme = 'light' | 'dark';
type ThemeMode = Theme | 'auto';

const normalizeTheme = (value: unknown): ThemeMode =>
  value === 'light' || value === 'dark' ? value : 'auto';

const ThemeContext = createContext<ThemeMode>('auto');
export const useTheme = () => useContext(ThemeContext);

const SetThemeContext = createContext<(theme: ThemeMode) => void>(() => {});
export const useSetTheme = () => useContext(SetThemeContext);

// 检测系统主题偏好
const getSystemTheme = (): Theme => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return 'light';
};

export const ThemeProvider = ({ children }: PropsWithChildren) => {
  const [theme, _setTheme] = useState<ThemeMode>(() => {
    try {
      return normalizeTheme(localStorage.getItem('theme-mode'));
    } catch {
      return 'auto';
    }
  });

  const [systemTheme, setSystemTheme] = useState(getSystemTheme());

  // 计算实际应用的主题
  const actualTheme = theme === 'auto' ? systemTheme : theme;

  // 监听系统主题变化
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      const handleSystemThemeChange = (e: MediaQueryListEvent) => {
        setSystemTheme(e.matches ? 'dark' : 'light');
      };

      mediaQuery.addEventListener('change', handleSystemThemeChange);

      return () => {
        mediaQuery.removeEventListener('change', handleSystemThemeChange);
      };
    }
  }, []);

  // 应用主题到DOM
  useEffect(() => {
    const body = document.body;
    if (actualTheme === 'dark') {
      body.setAttribute('theme-mode', 'dark');
      document.documentElement.classList.add('dark');
    } else {
      body.removeAttribute('theme-mode');
      document.documentElement.classList.remove('dark');
    }
  }, [actualTheme]);

  const setTheme = useCallback((newTheme: ThemeMode) => {
    _setTheme(newTheme);
    localStorage.setItem('theme-mode', newTheme);
  }, []);

  return (
    <SetThemeContext.Provider value={setTheme}>
      <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
    </SetThemeContext.Provider>
  );
};

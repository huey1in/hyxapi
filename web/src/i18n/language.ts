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

export const interfaceLanguages = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'ru', label: 'Русский' },
  { value: 'ja', label: '日本語' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'zh-TW', label: '繁體中文' },
] as const;

export const supportedLanguages = interfaceLanguages.map(({ value }) => value);

export const normalizeLanguage = (language: string | null | undefined) => {
  if (!language) {
    return language;
  }

  const normalized = language.trim().replace(/_/g, '-');
  const lower = normalized.toLowerCase();

  if (/^zh(?:tw|-(?:tw|hk|mo|hant)(?:-|$))/.test(lower)) {
    return 'zh-TW';
  }
  if (lower.startsWith('zh')) {
    return 'zh-CN';
  }

  const matchedLanguage = supportedLanguages.find(
    (supportedLanguage) => supportedLanguage.toLowerCase() === lower || supportedLanguage === lower.split('-')[0],
  );

  return matchedLanguage || 'en';
};

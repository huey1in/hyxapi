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
import { Languages } from 'lucide-react';

const LANGUAGES = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'ja', label: '日本語' },
  { code: 'ru', label: 'Русский' },
  { code: 'vi', label: 'Tiếng Việt' },
];

const LanguageSelector = ({ currentLang, onLanguageChange, t }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className='relative' ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t('common.changeLanguage')}
        className='inline-flex items-center justify-center w-9 h-9 rounded-full text-ui-text-2 hover:bg-ui-bg-subtle transition-colors'
      >
        <Languages size={18} />
      </button>

      {open && (
        <div className='absolute right-0 mt-2 w-40 bg-ui-bg-elevated border border-ui-border rounded-xl shadow-lg py-1 z-50'>
          {LANGUAGES.map(({ code, label }) => (
            <button
              key={code}
              onClick={() => { onLanguageChange(code); setOpen(false); }}
              className={`flex w-full px-3 py-2 text-sm transition-colors ${
                currentLang === code
                  ? 'bg-ui-bg-subtle text-ui-text font-semibold'
                  : 'text-ui-text-2 hover:bg-ui-bg-subtle hover:text-ui-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;

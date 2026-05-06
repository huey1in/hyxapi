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
import GlobeIcon from './icons/GlobeIcon';

const LANGUAGES = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'en', label: 'English' },
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
        className='inline-flex items-center justify-center w-11 h-11 rounded-xl text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle active:scale-90 transition-all duration-150'
      >
        <GlobeIcon size={22} />
      </button>

      {open && (
        <div className='absolute right-0 mt-3 w-52 bg-ui-bg-elevated border border-ui-border rounded-2xl shadow-xl overflow-hidden z-50 animate-dropdown'>
          <div className='px-3 pt-3 pb-1.5'>
            <p className='text-[11px] font-semibold text-ui-text-3 uppercase tracking-widest'>
              {t('语言')}
            </p>
          </div>
          <div className='px-2 pb-2 flex flex-col gap-0.5'>
            {LANGUAGES.map(({ code, label }) => (
              <button
                key={code}
                onClick={() => { onLanguageChange(code); setOpen(false); }}
                className={`flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  currentLang === code
                    ? 'bg-ui-bg-subtle text-ui-text font-medium'
                    : 'text-ui-text-2 hover:bg-ui-bg-subtle hover:text-ui-text'
                }`}
              >
                <span>{label}</span>
                {currentLang === code && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 7l3.5 3.5 6.5-7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;

/*
Copyright (C) 2025 QuantumNous

Top-bar language selector — uses the shared <Dropdown> with a
GlobeIcon trigger and a right-aligned popup.
*/

import React from 'react';
import GlobeIcon from './icons/GlobeIcon';
import Dropdown from '../../common/ui/Dropdown';

const LANGUAGES = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en', label: 'English' },
];

const LanguageSelector = ({ currentLang, onLanguageChange, t }) => (
  <Dropdown
    options={LANGUAGES}
    value={currentLang}
    onChange={onLanguageChange}
    placement='bottom-end'
    popupClassName='w-52'
    renderTrigger={({ onClick, ref }) => (
      <button
        ref={ref}
        onClick={onClick}
        aria-label={t('common.changeLanguage')}
        className='inline-flex items-center justify-center w-11 h-11 rounded-xl text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle active:scale-90 transition-all duration-150'
      >
        <GlobeIcon size={22} />
      </button>
    )}
  />
);

export default LanguageSelector;

/*
Copyright (C) 2025 QuantumNous

Top-bar language selector — uses the shared <Dropdown> with a
GlobeIcon trigger and a right-aligned popup.
*/

import React from 'react';
import GlobeIcon from './icons/GlobeIcon';
import Dropdown from '../../common/ui/Dropdown';
import IconButton from '../../ui/IconButton';

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
      <IconButton
        ref={ref}
        icon={GlobeIcon}
        variant='ghost'
        size='md'
        onClick={onClick}
        aria-label={t('common.changeLanguage')}
      />
    )}
  />
);

export default LanguageSelector;

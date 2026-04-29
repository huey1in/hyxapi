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
import { useTranslation } from 'react-i18next';
import { Hash, Thermometer, Target, Repeat, Ban, Shuffle, Check, X } from 'lucide-react';

const inputClass = 'w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-white disabled:opacity-50 disabled:cursor-not-allowed';

const ToggleBtn = ({ enabled, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${enabled ? 'bg-black text-white' : 'border border-gray-300 text-gray-400 bg-white'} disabled:opacity-40`}
  >
    {enabled ? <Check size={10} /> : <X size={10} />}
  </button>
);

const ParamSlider = ({ label, icon, desc, name, value, onChange, onToggle, enabled, disabled, min, max, step }) => (
  <div className={`mb-4 transition-opacity duration-200 ${!enabled || disabled ? 'opacity-50' : ''}`}>
    <div className='flex items-center justify-between mb-1'>
      <div className='flex items-center gap-2'>
        {icon}
        <span className='text-sm font-medium'>{label}</span>
        <span className='text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded'>{value}</span>
      </div>
      <ToggleBtn enabled={enabled} onClick={onToggle} disabled={disabled} />
    </div>
    {desc && <p className='text-xs text-gray-400 mb-2'>{desc}</p>}
    <input
      type='range'
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      disabled={!enabled || disabled}
      className='w-full accent-black disabled:cursor-not-allowed'
    />
  </div>
);

const ParameterControl = ({ inputs, parameterEnabled, onInputChange, onParameterToggle, disabled = false }) => {
  const { t } = useTranslation();

  return (
    <>
      <ParamSlider label='Temperature' icon={<Thermometer size={14} className='text-gray-400' />} desc={t('控制输出的随机性和创造性')}
        value={inputs.temperature} onChange={(v) => onInputChange('temperature', v)} onToggle={() => onParameterToggle('temperature')}
        enabled={parameterEnabled.temperature} disabled={disabled} min={0.1} max={1} step={0.1} />

      <ParamSlider label='Top P' icon={<Target size={14} className='text-gray-400' />} desc={t('核采样，控制词汇选择的多样性')}
        value={inputs.top_p} onChange={(v) => onInputChange('top_p', v)} onToggle={() => onParameterToggle('top_p')}
        enabled={parameterEnabled.top_p} disabled={disabled} min={0.1} max={1} step={0.1} />

      <ParamSlider label='Frequency Penalty' icon={<Repeat size={14} className='text-gray-400' />} desc={t('频率惩罚，减少重复词汇的出现')}
        value={inputs.frequency_penalty} onChange={(v) => onInputChange('frequency_penalty', v)} onToggle={() => onParameterToggle('frequency_penalty')}
        enabled={parameterEnabled.frequency_penalty} disabled={disabled} min={-2} max={2} step={0.1} />

      <ParamSlider label='Presence Penalty' icon={<Ban size={14} className='text-gray-400' />} desc={t('存在惩罚，鼓励讨论新话题')}
        value={inputs.presence_penalty} onChange={(v) => onInputChange('presence_penalty', v)} onToggle={() => onParameterToggle('presence_penalty')}
        enabled={parameterEnabled.presence_penalty} disabled={disabled} min={-2} max={2} step={0.1} />

      {/* Max Tokens */}
      <div className={`mb-4 transition-opacity duration-200 ${!parameterEnabled.max_tokens || disabled ? 'opacity-50' : ''}`}>
        <div className='flex items-center justify-between mb-2'>
          <div className='flex items-center gap-2'>
            <Hash size={14} className='text-gray-400' />
            <span className='text-sm font-medium'>Max Tokens</span>
          </div>
          <ToggleBtn enabled={parameterEnabled.max_tokens} onClick={() => onParameterToggle('max_tokens')} disabled={disabled} />
        </div>
        <input
          type='number'
          placeholder='Max Tokens'
          value={inputs.max_tokens || ''}
          onChange={(e) => onInputChange('max_tokens', e.target.value === '' ? 0 : parseInt(e.target.value))}
          min={0}
          disabled={!parameterEnabled.max_tokens || disabled}
          className={inputClass}
        />
      </div>

      {/* Seed */}
      <div className={`mb-4 transition-opacity duration-200 ${!parameterEnabled.seed || disabled ? 'opacity-50' : ''}`}>
        <div className='flex items-center justify-between mb-2'>
          <div className='flex items-center gap-2'>
            <Shuffle size={14} className='text-gray-400' />
            <span className='text-sm font-medium'>Seed</span>
            <span className='text-xs text-gray-400'>({t('可选，用于复现结果')})</span>
          </div>
          <ToggleBtn enabled={parameterEnabled.seed} onClick={() => onParameterToggle('seed')} disabled={disabled} />
        </div>
        <input
          type='text'
          placeholder={t('随机种子 (留空为随机)')}
          value={inputs.seed || ''}
          onChange={(e) => onInputChange('seed', e.target.value === '' ? null : e.target.value)}
          disabled={!parameterEnabled.seed || disabled}
          className={inputClass}
        />
      </div>
    </>
  );
};

export default ParameterControl;

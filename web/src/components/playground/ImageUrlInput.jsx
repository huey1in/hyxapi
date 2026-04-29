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
import { Plus, X, Image } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ImageUrlInput = ({ imageUrls, imageEnabled, onImageUrlsChange, onImageEnabledChange, disabled = false }) => {
  const { t } = useTranslation();

  const handleAddImageUrl = () => onImageUrlsChange([...imageUrls, '']);
  const handleUpdateImageUrl = (index, value) => {
    const newUrls = [...imageUrls];
    newUrls[index] = value;
    onImageUrlsChange(newUrls);
  };
  const handleRemoveImageUrl = (index) => onImageUrlsChange(imageUrls.filter((_, i) => i !== index));

  return (
    <div className={disabled ? 'opacity-50' : ''}>
      <div className='flex items-center justify-between mb-2'>
        <div className='flex items-center gap-2'>
          <Image size={14} className={imageEnabled && !disabled ? 'text-blue-500' : 'text-gray-400'} />
          <span className='text-sm font-medium'>{t('图片地址')}</span>
          {disabled && <span className='text-xs text-orange-600'>({t('已在自定义模式中忽略')})</span>}
        </div>
        <div className='flex items-center gap-2'>
          {/* toggle switch */}
          <button
            onClick={() => !disabled && onImageEnabledChange(!imageEnabled)}
            disabled={disabled}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-40 ${imageEnabled ? 'bg-black' : 'bg-gray-200'}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${imageEnabled ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
          </button>
          <button
            onClick={handleAddImageUrl}
            disabled={!imageEnabled || disabled}
            className='w-5 h-5 rounded-full flex items-center justify-center bg-black text-white hover:bg-[#333] transition-colors disabled:opacity-40'
          >
            <Plus size={11} />
          </button>
        </div>
      </div>

      <p className='text-xs text-gray-400 mb-2'>
        {!imageEnabled
          ? disabled ? t('图片功能在自定义请求体模式下不可用') : t('启用后可添加图片URL进行多模态对话')
          : imageUrls.length === 0
            ? t('点击 + 按钮添加图片URL进行多模态对话')
            : `${t('已添加')} ${imageUrls.length} ${t('张图片')}${disabled ? ` (${t('自定义模式下不可用')})` : ''}`
        }
      </p>

      <div className={`space-y-2 max-h-32 overflow-y-auto ${!imageEnabled || disabled ? 'opacity-50' : ''}`}>
        {imageUrls.map((url, index) => (
          <div key={index} className='flex items-center gap-2'>
            <input
              type='text'
              placeholder={`https://example.com/image${index + 1}.jpg`}
              value={url}
              onChange={(e) => handleUpdateImageUrl(index, e.target.value)}
              disabled={!imageEnabled || disabled}
              className='flex-1 px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-black disabled:cursor-not-allowed bg-white'
            />
            <button
              onClick={() => handleRemoveImageUrl(index)}
              disabled={!imageEnabled || disabled}
              className='w-6 h-6 rounded-full flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40'
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ImageUrlInput;

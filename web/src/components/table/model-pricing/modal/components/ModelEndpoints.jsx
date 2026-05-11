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
import { Link } from 'lucide-react';
import { Card } from '../../../../ui';

const ModelEndpoints = ({ modelData, endpointMap = {}, t }) => {
  const renderAPIEndpoints = () => {
    if (!modelData) return null;

    const mapping = endpointMap;
    const types = modelData.supported_endpoint_types || [];

    return types.map((type) => {
      const info = mapping[type] || {};
      let path = info.path || '';
      // 如果路径中包含 {model} 占位符，替换为真实模型名称
      if (path.includes('{model}')) {
        const modelName = modelData.model_name || modelData.modelName || '';
        path = path.replaceAll('{model}', modelName);
      }
      const method = info.method || 'POST';
      return (
        <div
          key={type}
          className='flex justify-between border-b border-dashed last:border-0 py-2 last:pb-0 border-ui-border'
        >
          <span className='flex items-center pr-5'>
            <span className='w-2 h-2 rounded-full bg-green-500 mr-2' />
            {type}
            {path && '：'}
            {path && (
              <span className='text-ui-text-2 md:ml-1 break-all'>{path}</span>
            )}
          </span>
          {path && (
            <span className='text-ui-text-2 text-xs md:ml-1'>{method}</span>
          )}
        </div>
      );
    });
  };

  return (
    <Card className='mb-6'>
      <div className='flex items-center mb-4'>
        <div className='w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center mr-2 shadow-md'>
          <Link size={16} className='text-purple-500' />
        </div>
        <div>
          <span className='text-lg font-medium text-ui-text'>{t('API端点')}</span>
          <div className='text-xs text-ui-text-2'>
            {t('模型支持的接口端点信息')}
          </div>
        </div>
      </div>
      {renderAPIEndpoints()}
    </Card>
  );
};

export default ModelEndpoints;

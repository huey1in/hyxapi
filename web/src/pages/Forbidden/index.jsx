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
import { ShieldX } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Forbidden = () => {
  const { t } = useTranslation();
  return (
    <div className='flex flex-col justify-center items-center h-screen p-8 gap-4'>
      <ShieldX size={80} className='text-ui-text-2 opacity-60' />
      <p className='text-ui-text-2 text-base'>
        {t('您无权访问此页面，请联系管理员')}
      </p>
    </div>
  );
};

export default Forbidden;

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
import { Loader2 } from 'lucide-react';

const Loading = ({ size = 'small' }) => {
  const sizeMap = { small: 20, middle: 28, large: 36 };
  const iconSize = sizeMap[size] || 20;

  return (
    <div className='fixed inset-0 w-screen h-screen flex items-center justify-center'>
      <Loader2 size={iconSize} className='animate-spin text-gray-500' />
    </div>
  );
};

export default Loading;

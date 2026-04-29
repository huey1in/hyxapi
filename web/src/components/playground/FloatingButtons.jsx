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
import { Settings, Eye, EyeOff } from 'lucide-react';

const FloatingButtons = ({
  styleState,
  showSettings,
  showDebugPanel,
  onToggleSettings,
  onToggleDebugPanel,
}) => {
  if (!styleState.isMobile) return null;

  return (
    <>
      {!showSettings && (
        <button
          onClick={onToggleSettings}
          className='fixed right-4 z-[1000] w-9 h-9 rounded-full flex items-center justify-center bg-black text-white shadow-lg lg:hidden'
          style={{ bottom: 90 }}
        >
          <Settings size={18} />
        </button>
      )}
      {!showSettings && (
        <button
          onClick={onToggleDebugPanel}
          className={`fixed right-4 z-[1000] w-9 h-9 rounded-full flex items-center justify-center text-white shadow-lg lg:hidden ${showDebugPanel ? 'bg-red-600' : 'bg-black'}`}
          style={{ bottom: 140 }}
        >
          {showDebugPanel ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      )}
    </>
  );
};

export default FloatingButtons;

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
import PropTypes from 'prop-types';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { Button } from '../../ui';

/**
 * 紧凑模式切换按钮组件
 */
const CompactModeToggle = ({
  compactMode,
  setCompactMode,
  t,
  className = '',
  ...props
}) => {
  const isMobile = useIsMobile();
  if (isMobile) return null;

  return (
    <Button
      variant='secondary'
      size='sm'
      onClick={() => setCompactMode(!compactMode)}
      className={className}
      {...props}
    >
      {compactMode ? t('自适应列表') : t('紧凑列表')}
    </Button>
  );
};

CompactModeToggle.propTypes = {
  compactMode: PropTypes.bool.isRequired,
  setCompactMode: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
  className: PropTypes.string,
};

export default CompactModeToggle;

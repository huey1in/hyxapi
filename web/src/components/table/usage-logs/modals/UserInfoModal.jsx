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
import ModalDialog from '../../../common/ModalDialog';
import { renderQuota, renderNumber } from '../../../../helpers';

const UserInfoModal = ({
  showUserInfo,
  setShowUserInfoModal,
  userInfoData,
  t,
}) => {
  const labelStyle = {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '2px',
    fontSize: '12px',
    gap: '6px',
  };

  const renderLabel = (text, color = '#888') => (
    <div style={labelStyle} className='text-ui-text-3'>
      <span className='w-1.5 h-1.5 rounded-full' style={{ backgroundColor: color }} />
      {text}
    </div>
  );

  const valueStyle = {
    fontSize: '14px',
    fontWeight: '600',
  };

  const rowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '16px',
    gap: '20px',
  };

  const colStyle = {
    flex: 1,
    minWidth: 0,
  };

  return (
    <ModalDialog
      open={showUserInfo}
      onClose={() => setShowUserInfoModal(false)}
      title={t('用户信息')}
      width={600}
      hideFooter
    >
      {userInfoData && (
        <div style={{ padding: 20 }}>
          {/* 基本信息 */}
          <div style={rowStyle}>
            <div style={colStyle}>
              {renderLabel(t('用户名'), '#3b82f6')}
              <div style={valueStyle} className='text-ui-text'>{userInfoData.username}</div>
            </div>
            {userInfoData.display_name && (
              <div style={colStyle}>
                {renderLabel(t('显示名称'), '#3b82f6')}
                <div style={valueStyle} className='text-ui-text'>{userInfoData.display_name}</div>
              </div>
            )}
          </div>

          {/* 余额信息 */}
          <div style={rowStyle}>
            <div style={colStyle}>
              {renderLabel(t('余额'), '#22c55e')}
              <div style={valueStyle} className='text-ui-text'>{renderQuota(userInfoData.quota)}</div>
            </div>
            <div style={colStyle}>
              {renderLabel(t('已用额度'), '#f59e0b')}
              <div style={valueStyle} className='text-ui-text'>
                {renderQuota(userInfoData.used_quota)}
              </div>
            </div>
          </div>

          {/* 统计信息 */}
          <div style={rowStyle}>
            <div style={colStyle}>
              {renderLabel(t('请求次数'), '#f59e0b')}
              <div style={valueStyle} className='text-ui-text'>
                {renderNumber(userInfoData.request_count)}
              </div>
            </div>
            {userInfoData.group && (
              <div style={colStyle}>
                {renderLabel(t('用户组'))}
                <div style={valueStyle} className='text-ui-text'>{userInfoData.group}</div>
              </div>
            )}
          </div>

          {/* 邀请信息 */}
          {(userInfoData.aff_code || userInfoData.aff_count !== undefined) && (
            <div style={rowStyle}>
              {userInfoData.aff_code && (
                <div style={colStyle}>
                  {renderLabel(t('邀请码'))}
                  <div style={valueStyle} className='text-ui-text'>{userInfoData.aff_code}</div>
                </div>
              )}
              {userInfoData.aff_count !== undefined && (
                <div style={colStyle}>
                  {renderLabel(t('邀请人数'))}
                  <div style={valueStyle} className='text-ui-text'>
                    {renderNumber(userInfoData.aff_count)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 邀请获得额度 */}
          {userInfoData.aff_quota !== undefined &&
            userInfoData.aff_quota > 0 && (
              <div style={{ marginBottom: '16px' }}>
                {renderLabel(t('邀请获得额度'), '#22c55e')}
                <div style={valueStyle} className='text-ui-text'>
                  {renderQuota(userInfoData.aff_quota)}
                </div>
              </div>
            )}

          {/* 备注 */}
          {userInfoData.remark && (
            <div style={{ marginBottom: 0 }}>
              {renderLabel(t('备注'))}
              <div
                style={{
                  ...valueStyle,
                  wordBreak: 'break-all',
                  lineHeight: '1.4',
                }}
                className='text-ui-text'
              >
                {userInfoData.remark}
              </div>
            </div>
          )}
        </div>
      )}
    </ModalDialog>
  );
};

export default UserInfoModal;

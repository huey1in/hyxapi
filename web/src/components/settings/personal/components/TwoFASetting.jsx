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
import { API, showError, showSuccess, showWarning } from '../../../../helpers';
import { Shield, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import ModalDialog from '../../../common/ModalDialog';
import { TextField, Notice } from '../../../common/form/Primitives';
import { Button } from '../../../ui';

import { QRCodeSVG } from 'qrcode.react';

const TwoFASetting = ({ t }) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({
    enabled: false,
    locked: false,
    backup_codes_remaining: 0,
  });

  // Modal states
  const [setupModalVisible, setSetupModalVisible] = useState(false);
  const [disableModalVisible, setDisableModalVisible] = useState(false);
  const [backupModalVisible, setBackupModalVisible] = useState(false);

  // Form data
  const [setupData, setSetupData] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Fetch 2FA status
  const fetchStatus = async () => {
    try {
      const res = await API.get('/api/user/2fa/status');
      if (res.data.success) {
        setStatus(res.data.data);
      }
    } catch (error) {
      showError(t('获取2FA状态失败'));
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // Initialize 2FA setup
  const handleSetup2FA = async () => {
    setLoading(true);
    try {
      const res = await API.post('/api/user/2fa/setup');
      if (res.data.success) {
        setSetupData(res.data.data);
        setSetupModalVisible(true);
        setCurrentStep(0);
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('设置2FA失败'));
    } finally {
      setLoading(false);
    }
  };

  // Enable 2FA
  const handleEnable2FA = async () => {
    if (!verificationCode) {
      showWarning(t('请输入验证码'));
      return;
    }

    setLoading(true);
    try {
      const res = await API.post('/api/user/2fa/enable', {
        code: verificationCode,
      });
      if (res.data.success) {
        showSuccess(t('两步验证启用成功！'));
        setSetupModalVisible(false);
        setVerificationCode('');
        setCurrentStep(0);
        fetchStatus();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('启用2FA失败'));
    } finally {
      setLoading(false);
    }
  };

  // Disable 2FA
  const handleDisable2FA = async () => {
    if (!verificationCode) {
      showWarning(t('请输入验证码或备用码'));
      return;
    }

    if (!confirmDisable) {
      showWarning(t('请确认您已了解禁用两步验证的后果'));
      return;
    }

    setLoading(true);
    try {
      const res = await API.post('/api/user/2fa/disable', {
        code: verificationCode,
      });
      if (res.data.success) {
        showSuccess(t('两步验证已禁用'));
        setDisableModalVisible(false);
        setVerificationCode('');
        setConfirmDisable(false);
        fetchStatus();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('禁用2FA失败'));
    } finally {
      setLoading(false);
    }
  };

  // Regenerate backup codes
  const handleRegenerateBackupCodes = async () => {
    if (!verificationCode) {
      showWarning(t('请输入验证码'));
      return;
    }

    setLoading(true);
    try {
      const res = await API.post('/api/user/2fa/backup_codes', {
        code: verificationCode,
      });
      if (res.data.success) {
        setBackupCodes(res.data.data.backup_codes);
        showSuccess(t('备用码重新生成成功'));
        setVerificationCode('');
        fetchStatus();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('重新生成备用码失败'));
    } finally {
      setLoading(false);
    }
  };

  // Copy utility
  const copyTextToClipboard = (text, successMessage = t('已复制到剪贴板')) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        showSuccess(successMessage);
      })
      .catch(() => {
        showError(t('复制失败，请手动复制'));
      });
  };

  const copyBackupCodes = () => {
    const codesText = backupCodes.join('\n');
    copyTextToClipboard(codesText, t('备用码已复制到剪贴板'));
  };

  // Backup codes display component
  const BackupCodesDisplay = ({ codes, title, onCopy }) => {
    return (
      <div className='border border-ui-border rounded-xl p-4' style={{ backgroundColor: 'var(--page-bg)' }}>
        <div className='space-y-3'>
          <div className='flex items-center justify-between'>
            <span className='font-semibold text-sm text-ui-text'>
              {title}
            </span>
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
            {codes.map((code, index) => (
              <div key={index} className='rounded-lg p-3 bg-ui-bg-subtle'>
                <div className='flex items-center justify-between'>
                  <code className='text-sm font-mono text-ui-text'>
                    {code}
                  </code>
                  <span className='text-xs text-ui-text-3'>
                    #{(index + 1).toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className='border-t border-ui-border my-3' />
          <Button className='w-full' onClick={onCopy}>
            {t('复制所有代码')}
          </Button>
        </div>
      </div>
    );
  };

  // Setup modal footer
  const renderSetupModalFooter = () => (
    <>
      {currentStep > 0 && (
        <Button variant='secondary' onClick={() => setCurrentStep(currentStep - 1)}>
          {t('上一步')}
        </Button>
      )}
      {currentStep < 2 ? (
        <Button onClick={() => setCurrentStep(currentStep + 1)}>
          {t('下一步')}
        </Button>
      ) : (
        <Button
          icon={loading ? Loader2 : undefined}
          disabled={loading || !verificationCode}
          onClick={() => {
            if (!verificationCode) {
              showWarning(t('请输入验证码'));
              return;
            }
            handleEnable2FA();
          }}
        >
          {t('完成设置并启用两步验证')}
        </Button>
      )}
    </>
  );

  // Disable modal footer
  const renderDisableModalFooter = () => (
    <>
      <Button
        variant='secondary'
        onClick={() => {
          setDisableModalVisible(false);
          setVerificationCode('');
          setConfirmDisable(false);
        }}
      >
        {t('取消')}
      </Button>
      <Button
        variant='dangerSolid'
        icon={loading ? Loader2 : undefined}
        disabled={loading || !confirmDisable || !verificationCode}
        onClick={handleDisable2FA}
      >
        {t('确认禁用')}
      </Button>
    </>
  );

  // Regenerate modal footer
  const renderRegenerateModalFooter = () => {
    if (backupCodes.length > 0) {
      return (
        <Button
          onClick={() => {
            setBackupModalVisible(false);
            setVerificationCode('');
            setBackupCodes([]);
          }}
        >
          {t('完成')}
        </Button>
      );
    }

    return (
      <>
        <Button
          variant='secondary'
          onClick={() => {
            setBackupModalVisible(false);
            setVerificationCode('');
            setBackupCodes([]);
          }}
        >
          {t('取消')}
        </Button>
        <Button
          icon={loading ? Loader2 : undefined}
          disabled={loading || !verificationCode}
          onClick={handleRegenerateBackupCodes}
        >
          {t('生成新的备用码')}
        </Button>
      </>
    );
  };

  return (
    <>
      <div className='border border-ui-border rounded-xl p-4 w-full' style={{ backgroundColor: 'var(--page-bg)' }}>
        <div className='flex flex-col sm:flex-row items-start sm:justify-between gap-4'>
          <div className='flex items-start w-full sm:w-auto'>
            <div className='w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-4 flex-shrink-0'>
              <Shield size={20} className='text-slate-600 dark:text-slate-300' />
            </div>
            <div className='flex-1'>
              <div className='flex items-center gap-2 mb-1'>
                <h6 className='text-sm font-semibold text-ui-text'>
                  {t('两步验证设置')}
                </h6>
                {status.enabled ? (
                  <span className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-md font-medium bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'>
                    {t('已启用')}
                  </span>
                ) : (
                  <span className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-md font-medium bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'>
                    {t('未启用')}
                  </span>
                )}
                {status.locked && (
                  <span className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-md font-medium bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20'>
                    {t('账户已锁定')}
                  </span>
                )}
              </div>
              <span className='text-sm text-ui-text-2'>
                {t(
                  '两步验证（2FA）为您的账户提供额外的安全保护。启用后，登录时需要输入密码和验证器应用生成的验证码。',
                )}
              </span>
              {status.enabled && (
                <div className='mt-2'>
                  <span className='text-xs text-ui-text-2'>
                    {t('剩余备用码：')}
                    {status.backup_codes_remaining || 0}
                    {t('个')}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className='flex flex-col space-y-2 w-full sm:w-auto'>
            {!status.enabled ? (
              <Button
                icon={loading ? Loader2 : undefined}
                onClick={handleSetup2FA}
                disabled={loading}
              >
                {t('启用验证')}
              </Button>
            ) : (
              <div className='flex flex-col space-y-2'>
                <Button
                  variant='dangerSolid'
                  onClick={() => setDisableModalVisible(true)}
                >
                  {t('禁用两步验证')}
                </Button>
                <Button
                  variant='secondary'
                  onClick={() => setBackupModalVisible(true)}
                >
                  {t('重新生成备用码')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2FA Setup Modal */}
      <ModalDialog
        open={setupModalVisible}
        onClose={() => {
          setSetupModalVisible(false);
          setSetupData(null);
          setCurrentStep(0);
          setVerificationCode('');
        }}
        title={
          <div className='flex items-center'>
            <Shield size={16} className='mr-2 text-slate-600' />
            {t('设置两步验证')}
          </div>
        }
        footer={renderSetupModalFooter()}
        width={650}
      >
        {setupData && (
          <div className='space-y-6'>
            {/* Step indicator */}
            <div className='flex items-center gap-2'>
              {[t('扫描二维码'), t('保存备用码'), t('验证设置')].map((label, i) => (
                <div key={i} className='flex items-center gap-2 flex-1'>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                    i <= currentStep ? 'bg-ui-accent text-ui-accent-fg' : 'bg-ui-bg-subtle text-ui-text-3 border border-ui-border'
                  }`}>
                    {i + 1}
                  </div>
                  <span className={`text-xs hidden sm:inline ${i <= currentStep ? 'text-ui-text' : 'text-ui-text-3'}`}>
                    {label}
                  </span>
                  {i < 2 && <div className='flex-1 h-px bg-ui-border' />}
                </div>
              ))}
            </div>

            {/* Step content */}
            <div className='rounded-xl'>
              {currentStep === 0 && (
                <div>
                  <p className='text-sm text-ui-text-2 mb-4'>
                    {t(
                      '使用认证器应用（如 Google Authenticator、Microsoft Authenticator）扫描下方二维码：',
                    )}
                  </p>
                  <div className='flex justify-center mb-4'>
                    <div className='bg-white p-4 rounded-lg shadow-sm'>
                      <QRCodeSVG value={setupData.url} size={180} />
                    </div>
                  </div>
                  <div className='bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3'>
                    <span className='text-blue-800 dark:text-blue-200 text-sm'>
                      {t('或手动输入密钥：')}
                      <code className='ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-800 rounded text-xs font-mono cursor-pointer' onClick={() => copyTextToClipboard(setupData.secret)}>
                        {setupData.secret}
                      </code>
                    </span>
                  </div>
                </div>
              )}

              {currentStep === 1 && (
                <div className='space-y-4'>
                  <BackupCodesDisplay
                    codes={setupData.backup_codes}
                    title={t('备用恢复代码')}
                    onCopy={() => {
                      const codesText = setupData.backup_codes.join('\n');
                      copyTextToClipboard(codesText, t('备用码已复制到剪贴板'));
                    }}
                  />
                </div>
              )}

              {currentStep === 2 && (
                <TextField
                  placeholder={t('输入认证器应用显示的6位数字验证码')}
                  value={verificationCode}
                  onChange={setVerificationCode}
                  maxLength={6}
                />
              )}
            </div>
          </div>
        )}
      </ModalDialog>

      {/* Disable 2FA Modal */}
      <ModalDialog
        open={disableModalVisible}
        onClose={() => {
          setDisableModalVisible(false);
          setVerificationCode('');
          setConfirmDisable(false);
        }}
        title={
          <div className='flex items-center'>
            <AlertTriangle size={16} className='mr-2 text-red-500' />
            {t('禁用两步验证')}
          </div>
        }
        footer={renderDisableModalFooter()}
        width={550}
      >
        <div className='space-y-6'>
          <Notice kind='warning'>
            {t(
              '警告：禁用两步验证将永久删除您的验证设置和所有备用码，此操作不可撤销！',
            )}
          </Notice>

          <div className='space-y-4'>
            <div>
              <span className='block mb-2 text-sm font-semibold text-ui-text'>
                {t('禁用后的影响：')}
              </span>
              <ul className='space-y-2 text-sm text-ui-text-2'>
                <li className='flex items-start gap-2'>
                  <span className='w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0' />
                  {t('降低您账户的安全性')}
                </li>
                <li className='flex items-start gap-2'>
                  <span className='w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0' />
                  {t('需要重新完整设置才能再次启用')}
                </li>
                <li className='flex items-start gap-2'>
                  <span className='w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0' />
                  {t('永久删除您的两步验证设置')}
                </li>
                <li className='flex items-start gap-2'>
                  <span className='w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0' />
                  {t('永久删除所有备用码（包括未使用的）')}
                </li>
              </ul>
            </div>

            <div className='border-t border-ui-border' />

            <div className='space-y-4'>
              <div>
                <span className='block mb-2 text-sm font-semibold text-ui-text'>
                  {t('验证身份')}
                </span>
                <TextField
                  placeholder={t('请输入认证器验证码或备用码')}
                  value={verificationCode}
                  onChange={setVerificationCode}
                />
              </div>

              <label className='flex items-start gap-2 cursor-pointer'>
                <input
                  type='checkbox'
                  checked={confirmDisable}
                  onChange={(e) => setConfirmDisable(e.target.checked)}
                  className='mt-0.5 rounded border-ui-border'
                />
                <span className='text-sm text-ui-text-2'>
                  {t(
                    '我已了解禁用两步验证将永久删除所有相关设置和备用码，此操作不可撤销',
                  )}
                </span>
              </label>
            </div>
          </div>
        </div>
      </ModalDialog>

      {/* Regenerate Backup Codes Modal */}
      <ModalDialog
        open={backupModalVisible}
        onClose={() => {
          setBackupModalVisible(false);
          setVerificationCode('');
          setBackupCodes([]);
        }}
        title={
          <div className='flex items-center'>
            <RefreshCw size={16} className='mr-2 text-slate-600' />
            {t('重新生成备用码')}
          </div>
        }
        footer={renderRegenerateModalFooter()}
        width={500}
      >
        <div className='space-y-6'>
          {backupCodes.length === 0 ? (
            <>
              <Notice kind='warning'>
                {t(
                  '重新生成备用码将使现有的备用码失效，请确保您已保存了当前的备用码。',
                )}
              </Notice>

              <div className='space-y-4'>
                <div>
                  <span className='block mb-2 text-sm font-semibold text-ui-text'>
                    {t('验证身份')}
                  </span>
                  <TextField
                    placeholder={t('请输入认证器验证码')}
                    value={verificationCode}
                    onChange={setVerificationCode}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className='space-y-4 w-full'>
              <div className='flex items-center justify-center gap-2'>
                <span className='w-2 h-2 rounded-full bg-green-500' />
                <span className='text-lg font-semibold text-ui-text'>
                  {t('新的备用码已生成')}
                </span>
              </div>
              <p className='text-sm text-ui-text-2 text-center'>
                {t('旧的备用码已失效，请保存新的备用码')}
              </p>

              <BackupCodesDisplay
                codes={backupCodes}
                title={t('新的备用恢复代码')}
                onCopy={copyBackupCodes}
              />
            </div>
          )}
        </div>
      </ModalDialog>
    </>
  );
};

export default TwoFASetting;

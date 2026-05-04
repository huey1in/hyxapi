/*
 * 仪表盘内容 wrapper — token shell.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { API, showError, showSuccess, toBoolean } from '../../helpers';
import { showConfirm } from '../common/ConfirmDialog';
import SettingsAPIInfo from '../../pages/Setting/Dashboard/SettingsAPIInfo';
import SettingsAnnouncements from '../../pages/Setting/Dashboard/SettingsAnnouncements';
import SettingsFAQ from '../../pages/Setting/Dashboard/SettingsFAQ';
import SettingsUptimeKuma from '../../pages/Setting/Dashboard/SettingsUptimeKuma';
import SettingsDataDashboard from '../../pages/Setting/Dashboard/SettingsDataDashboard';

const TokenCard = ({ children, className = '' }) => (
  <div className={`bg-ui-bg-elevated border border-ui-border rounded-xl p-5 ${className}`}>
    {children}
  </div>
);

const DashboardSetting = () => {
  let [inputs, setInputs] = useState({
    'console_setting.api_info': '',
    'console_setting.announcements': '',
    'console_setting.faq': '',
    'console_setting.uptime_kuma_groups': '',
    'console_setting.api_info_enabled': '',
    'console_setting.announcements_enabled': '',
    'console_setting.faq_enabled': '',
    'console_setting.uptime_kuma_enabled': '',
    ApiInfo: '',
    Announcements: '',
    FAQ: '',
    UptimeKumaUrl: '',
    UptimeKumaSlug: '',
    DataExportEnabled: false,
    DataExportDefaultTime: 'hour',
    DataExportInterval: 5,
  });

  let [loading, setLoading] = useState(false);

  const getOptions = async () => {
    const res = await API.get('/api/option/');
    const { success, message, data } = res.data;
    if (success) {
      let newInputs = {};
      data.forEach((item) => {
        if (item.key in inputs) {
          newInputs[item.key] = item.value;
        }
        if (item.key.endsWith('Enabled') && item.key === 'DataExportEnabled') {
          newInputs[item.key] = toBoolean(item.value);
        }
      });
      setInputs(newInputs);
    } else {
      showError(message);
    }
  };

  async function onRefresh() {
    try {
      setLoading(true);
      await getOptions();
    } catch (error) {
      showError('刷新失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    onRefresh();
  }, []);

  const hasLegacyData = useMemo(() => {
    const legacyKeys = ['ApiInfo', 'Announcements', 'FAQ', 'UptimeKumaUrl', 'UptimeKumaSlug'];
    return legacyKeys.some((k) => inputs[k]);
  }, [inputs]);

  useEffect(() => {
    if (hasLegacyData) {
      showConfirm({
        title: '配置迁移确认',
        content: '检测到旧版本的配置数据，是否要迁移到新的配置格式？迁移过程中会自动处理数据格式转换，迁移完成后旧配置将被清除，请在迁移前在数据库中备份好旧配置。',
        danger: true,
        okText: '确认迁移',
        onOk: handleMigrate,
      });
    }
  }, [hasLegacyData]);

  const handleMigrate = async () => {
    try {
      setLoading(true);
      await API.post('/api/option/migrate_console_setting');
      showSuccess('旧配置迁移完成');
      await onRefresh();
    } catch (err) {
      showError('迁移失败: ' + (err.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='space-y-3 relative'>
      {loading && (
        <div className='absolute inset-0 z-10 flex items-center justify-center bg-ui-bg/60'>
          </div>
      )}

      <TokenCard>
        <SettingsDataDashboard options={inputs} refresh={onRefresh} />
      </TokenCard>
      <TokenCard>
        <SettingsAnnouncements options={inputs} refresh={onRefresh} />
      </TokenCard>
      <TokenCard>
        <SettingsAPIInfo options={inputs} refresh={onRefresh} />
      </TokenCard>
      <TokenCard>
        <SettingsFAQ options={inputs} refresh={onRefresh} />
      </TokenCard>
      <TokenCard>
        <SettingsUptimeKuma options={inputs} refresh={onRefresh} />
      </TokenCard>
    </div>
  );
};

export default DashboardSetting;

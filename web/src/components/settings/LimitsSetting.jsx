/*
 * 限制与监控 wrapper — token shell, leaf forms still Semi.
 */

import React, { useEffect, useState } from 'react';
import SettingsCreditLimit from '../../pages/Setting/Operation/SettingsCreditLimit';
import RequestRateLimit from '../../pages/Setting/RateLimit/SettingsRequestRateLimit';
import SettingsMonitoring from '../../pages/Setting/Operation/SettingsMonitoring';
import SettingsLog from '../../pages/Setting/Operation/SettingsLog';
import SettingsSensitiveWords from '../../pages/Setting/Operation/SettingsSensitiveWords';
import { API, showError, toBoolean } from '../../helpers';

const TokenCard = ({ children, className = '' }) => (
  <div className={`bg-ui-bg-elevated border border-ui-border rounded-xl p-5 ${className}`}>
    {children}
  </div>
);

const LimitsSetting = () => {
  let [inputs, setInputs] = useState({
    QuotaForNewUser: 0,
    PreConsumedQuota: 0,
    QuotaForInviter: 0,
    QuotaForInvitee: 0,
    'quota_setting.enable_free_model_pre_consume': true,
    ModelRequestRateLimitEnabled: false,
    ModelRequestRateLimitCount: 0,
    ModelRequestRateLimitSuccessCount: 1000,
    ModelRequestRateLimitDurationMinutes: 1,
    ModelRequestRateLimitGroup: '',
    ChannelDisableThreshold: 0,
    QuotaRemindThreshold: 0,
    AutomaticDisableChannelEnabled: false,
    AutomaticEnableChannelEnabled: false,
    AutomaticDisableKeywords: '',
    AutomaticDisableStatusCodes: '401',
    AutomaticRetryStatusCodes:
      '100-199,300-399,401-407,409-499,500-503,505-523,525-599',
    'monitor_setting.auto_test_channel_enabled': false,
    'monitor_setting.auto_test_channel_minutes': 10,
    LogConsumeEnabled: false,
    CheckSensitiveEnabled: false,
    CheckSensitiveOnPromptEnabled: false,
    SensitiveWords: '',
  });

  let [loading, setLoading] = useState(false);

  const getOptions = async () => {
    const res = await API.get('/api/option/');
    const { success, message, data } = res.data;
    if (success) {
      let newInputs = {};
      data.forEach((item) => {
        if (item.key === 'ModelRequestRateLimitGroup') {
          try {
            item.value = JSON.stringify(JSON.parse(item.value), null, 2);
          } catch {}
        }
        if (typeof inputs[item.key] === 'boolean') {
          newInputs[item.key] = toBoolean(item.value);
        } else {
          newInputs[item.key] = item.value;
        }
      });
      setInputs(newInputs);
    } else {
      showError(message);
    }
  };

  const onRefresh = async () => {
    try {
      setLoading(true);
      await getOptions();
    } catch (error) {
      showError('刷新失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    onRefresh();
  }, []);

  return (
    <div className='space-y-3 relative'>
      {loading && (
        <div className='absolute inset-0 z-10 flex items-center justify-center bg-ui-bg/60'>
          </div>
      )}
      <TokenCard>
        <SettingsCreditLimit options={inputs} refresh={onRefresh} />
      </TokenCard>
      <TokenCard>
        <RequestRateLimit options={inputs} refresh={onRefresh} />
      </TokenCard>
      <TokenCard>
        <SettingsMonitoring options={inputs} refresh={onRefresh} />
      </TokenCard>
      <TokenCard>
        <SettingsLog options={inputs} refresh={onRefresh} />
      </TokenCard>
      <TokenCard>
        <SettingsSensitiveWords options={inputs} refresh={onRefresh} />
      </TokenCard>
    </div>
  );
};

export default LimitsSetting;

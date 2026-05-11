/*
 * 平台设置 wrapper —
 *   通用（链接/汇率/Token显示/全局开关）
 *   顶栏导航模块
 *   侧边栏模块（管理员）
 *   公告 / 用户协议 / 隐私政策（来自 OtherSetting）
 *
 * Token-system shell only; the leaf SettingsXxx forms are still Semi
 * inside (see Phase 3 of settings rewrite roadmap).
 */
import React, { useEffect, useState } from 'react';
import SettingsGeneral from '../../pages/Setting/Operation/SettingsGeneral';
import OtherSetting from './OtherSetting';
import { API, showError, toBoolean } from '../../helpers';

const TokenCard = ({ children, className = '' }) => (
  <div className={`bg-ui-bg-elevated border border-ui-border rounded-xl p-5 ${className}`}>
    {children}
  </div>
);

const OperationSetting = () => {
  let [inputs, setInputs] = useState({
    TopUpLink: '',
    'general_setting.docs_link': '',
    QuotaPerUnit: 0,
    USDExchangeRate: 0,
    RetryTimes: 0,
    'general_setting.quota_display_type': 'USD',
    DisplayTokenStatEnabled: false,
    DefaultCollapseSidebar: false,
    DemoSiteEnabled: false,
    SelfUseModeEnabled: false,
    HeaderNavModules: '',
    SidebarModulesAdmin: '',
    'token_setting.max_user_tokens': 1000,
  });

  let [loading, setLoading] = useState(false);

  const getOptions = async () => {
    const res = await API.get('/api/option/');
    const { success, message, data } = res.data;
    if (success) {
      let newInputs = {};
      data.forEach((item) => {
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

  return (
    <div className='space-y-3 relative'>
      {loading && (
        <div className='absolute inset-0 z-10 flex items-center justify-center bg-ui-bg/60'>
          </div>
      )}
      <TokenCard>
        <SettingsGeneral options={inputs} refresh={onRefresh} />
      </TokenCard>
      <TokenCard>
        <OtherSetting />
      </TokenCard>
    </div>
  );
};

export default OperationSetting;

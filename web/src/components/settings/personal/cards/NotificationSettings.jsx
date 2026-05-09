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

import React, { useRef, useEffect, useState, useContext } from 'react';
import { Bell, Link, Key, Mail, Loader2 } from 'lucide-react';
import {
  renderQuotaWithPrompt,
  API,
  showSuccess,
  showError,
} from '../../../../helpers';
import { TextField, FieldRow, Toggle, ToggleField } from '../../../common/form/Primitives';
import CodeViewer from '../../../playground/CodeViewer';
import { StatusContext } from '../../../../context/Status';
import { UserContext } from '../../../../context/User';
import { useUserPermissions } from '../../../../hooks/common/useUserPermissions';
import {
  mergeAdminConfig,
  useSidebar,
} from '../../../../hooks/common/useSidebar';

const NotificationSettings = ({
  t,
  notificationSettings,
  handleNotificationSettingChange,
  saveNotificationSettings,
}) => {
  const [statusState] = useContext(StatusContext);
  const [userState] = useContext(UserContext);
  const isAdminOrRoot = (userState?.user?.role || 0) >= 10;

  // Sidebar settings state
  const [sidebarLoading, setSidebarLoading] = useState(false);
  const [activeTabKey, setActiveTabKey] = useState('notification');
  const [sidebarModulesUser, setSidebarModulesUser] = useState({
    chat: { enabled: true, playground: true, chat: true },
    console: { enabled: true, detail: true, token: true, log: true, midjourney: true, task: true },
    personal: { enabled: true, topup: true, personal: true },
    admin: { enabled: true, channel: true, models: true, deployment: true, subscription: true, redemption: true, user: true, setting: true },
  });
  const [adminConfig, setAdminConfig] = useState(null);

  const {
    permissions,
    loading: permissionsLoading,
    hasSidebarSettingsPermission,
    isSidebarSectionAllowed,
    isSidebarModuleAllowed,
  } = useUserPermissions();

  const { refreshUserConfig } = useSidebar();

  // Sidebar section toggle
  const handleSectionChange = (sectionKey) => {
    return (checked) => {
      const newModules = {
        ...sidebarModulesUser,
        [sectionKey]: { ...sidebarModulesUser[sectionKey], enabled: checked },
      };
      setSidebarModulesUser(newModules);
    };
  };

  const handleModuleChange = (sectionKey, moduleKey) => {
    return (checked) => {
      const newModules = {
        ...sidebarModulesUser,
        [sectionKey]: { ...sidebarModulesUser[sectionKey], [moduleKey]: checked },
      };
      setSidebarModulesUser(newModules);
    };
  };

  const saveSidebarSettings = async () => {
    setSidebarLoading(true);
    try {
      const res = await API.put('/api/user/self', {
        sidebar_modules: JSON.stringify(sidebarModulesUser),
      });
      if (res.data.success) {
        showSuccess(t('侧边栏设置保存成功'));
        await refreshUserConfig();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('保存失败'));
    }
    setSidebarLoading(false);
  };

  const resetSidebarModules = () => {
    const defaultConfig = {
      chat: { enabled: true, playground: true, chat: true },
      console: { enabled: true, detail: true, token: true, log: true, midjourney: true, task: true },
      personal: { enabled: true, topup: true, personal: true },
      admin: { enabled: true, channel: true, models: true, deployment: true, subscription: true, redemption: true, user: true, setting: true },
    };
    setSidebarModulesUser(defaultConfig);
  };

  // Load sidebar configs
  useEffect(() => {
    const loadSidebarConfigs = async () => {
      try {
        if (statusState?.status?.SidebarModulesAdmin) {
          try {
            const adminConf = JSON.parse(statusState.status.SidebarModulesAdmin);
            setAdminConfig(mergeAdminConfig(adminConf));
          } catch (error) {
            setAdminConfig(mergeAdminConfig(null));
          }
        } else {
          setAdminConfig(mergeAdminConfig(null));
        }

        const userRes = await API.get('/api/user/self');
        if (userRes.data.success && userRes.data.data.sidebar_modules) {
          let userConf;
          if (typeof userRes.data.data.sidebar_modules === 'string') {
            userConf = JSON.parse(userRes.data.data.sidebar_modules);
          } else {
            userConf = userRes.data.data.sidebar_modules;
          }
          setSidebarModulesUser(userConf);
        }
      } catch (error) {
        console.error('加载边栏配置失败:', error);
      }
    };

    loadSidebarConfigs();
  }, [statusState]);

  // Check if feature is allowed by admin
  const isAllowedByAdmin = (sectionKey, moduleKey = null) => {
    if (!adminConfig) return true;
    if (moduleKey) {
      return adminConfig[sectionKey]?.enabled && adminConfig[sectionKey]?.[moduleKey];
    } else {
      return adminConfig[sectionKey]?.enabled;
    }
  };

  // Section configs (filtered by permissions)
  const sectionConfigs = [
    {
      key: 'chat', title: t('聊天区域'), description: t('操练场和聊天功能'),
      modules: [
        { key: 'playground', title: t('操练场'), description: t('AI模型测试环境') },
        { key: 'chat', title: t('聊天'), description: t('聊天会话管理') },
      ],
    },
    {
      key: 'console', title: t('控制台区域'), description: t('数据管理和日志查看'),
      modules: [
        { key: 'detail', title: t('数据看板'), description: t('系统数据统计') },
        { key: 'token', title: t('令牌管理'), description: t('API令牌管理') },
        { key: 'log', title: t('使用日志'), description: t('API使用记录') },
        { key: 'midjourney', title: t('绘图日志'), description: t('绘图任务记录') },
        { key: 'task', title: t('任务日志'), description: t('系统任务记录') },
      ],
    },
    {
      key: 'personal', title: t('个人中心区域'), description: t('用户个人功能'),
      modules: [
        { key: 'topup', title: t('钱包管理'), description: t('余额充值管理') },
        { key: 'personal', title: t('个人设置'), description: t('个人信息设置') },
      ],
    },
    {
      key: 'admin', title: t('管理员区域'), description: t('系统管理功能'),
      modules: [
        { key: 'channel', title: t('渠道管理'), description: t('API渠道配置') },
        { key: 'models', title: t('模型管理'), description: t('AI模型配置') },
        { key: 'deployment', title: t('模型部署'), description: t('模型部署管理') },
        { key: 'subscription', title: t('订阅管理'), description: t('订阅套餐管理') },
        { key: 'redemption', title: t('兑换码管理'), description: t('兑换码生成管理') },
        { key: 'user', title: t('用户管理'), description: t('用户账户管理') },
        { key: 'setting', title: t('系统设置'), description: t('系统参数配置') },
      ],
    },
  ]
    .filter((section) => isSidebarSectionAllowed(section.key))
    .map((section) => ({
      ...section,
      modules: section.modules.filter((module) => isSidebarModuleAllowed(section.key, module.key)),
    }))
    .filter((section) => section.modules.length > 0 && isAllowedByAdmin(section.key));

  const handleSubmit = () => {
    saveNotificationSettings();
  };

  const tabs = [
    { key: 'notification', label: t('通知配置') },
    { key: 'pricing', label: t('价格设置') },
    { key: 'privacy', label: t('隐私设置') },
    ...(hasSidebarSettingsPermission() ? [{ key: 'sidebar', label: t('边栏设置') }] : []),
  ];

  return (
    <div className='border border-ui-border rounded-2xl' style={{ backgroundColor: 'var(--page-bg)' }}>
      {/* Card header */}
      <div className='flex items-center p-4 pb-0'>
        <div className='w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center mr-3'>
          <Bell size={16} className='text-blue-600' />
        </div>
        <div>
          <span className='text-lg font-medium text-ui-text'>
            {t('其他设置')}
          </span>
          <div className='text-xs text-ui-text-2'>
            {t('通知、价格和隐私相关设置')}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className='flex gap-1 px-4 mt-4 border-b border-ui-border'>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTabKey(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTabKey === tab.key
                ? 'border-ui-accent text-ui-text'
                : 'border-transparent text-ui-text-2 hover:text-ui-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className='p-4'>
        {/* Notification tab */}
        {activeTabKey === 'notification' && (
          <div className='space-y-4'>
            {/* Warning type */}
            <FieldRow label={t('通知方式')}>
              <div className='flex flex-wrap gap-3'>
                {[
                  { value: 'email', label: t('邮件通知') },
                  { value: 'webhook', label: t('Webhook通知') },
                  { value: 'bark', label: t('Bark通知') },
                  { value: 'gotify', label: t('Gotify通知') },
                ].map((opt) => (
                  <label key={opt.value} className='flex items-center gap-2 cursor-pointer'>
                    <input
                      type='radio'
                      name='warningType'
                      value={opt.value}
                      checked={notificationSettings.warningType === opt.value}
                      onChange={() => handleNotificationSettingChange('warningType', opt.value)}
                      className='accent-current'
                    />
                    <span className='text-sm text-ui-text'>{opt.label}</span>
                  </label>
                ))}
              </div>
            </FieldRow>

            {/* Warning threshold */}
            <FieldRow
              label={
                <span>
                  {t('额度预警阈值')}{' '}
                  {renderQuotaWithPrompt(notificationSettings.warningThreshold)}
                </span>
              }
              hint={t('当钱包或订阅剩余额度低于此数值时，系统将通过选择的方式发送通知')}
            >
              <div style={{ maxWidth: '300px' }}>
                <TextField
                  placeholder={t('请输入预警额度')}
                  value={notificationSettings.warningThreshold}
                  onChange={(val) => handleNotificationSettingChange('warningThreshold', val)}
                  prefix={<Bell size={14} />}
                />
              </div>
            </FieldRow>

            {isAdminOrRoot && (
              <ToggleField
                label={t('接收上游模型更新通知')}
                hint={t('仅管理员可用。开启后，当系统定时检测全部渠道发现上游模型变更或检测异常时，将按你选择的通知方式发送汇总通知；渠道或模型过多时会自动省略部分明细。')}
                checked={!!notificationSettings.upstreamModelUpdateNotifyEnabled}
                onChange={(value) => handleNotificationSettingChange('upstreamModelUpdateNotifyEnabled', value)}
              />
            )}

            {/* Email notification settings */}
            {notificationSettings.warningType === 'email' && (
              <FieldRow
                label={t('通知邮箱')}
                hint={t('设置用于接收额度预警的邮箱地址，不填则使用账号绑定的邮箱')}
              >
                <TextField
                  placeholder={t('留空则使用账号绑定的邮箱')}
                  value={notificationSettings.notificationEmail}
                  onChange={(val) => handleNotificationSettingChange('notificationEmail', val)}
                  prefix={<Mail size={14} />}
                />
              </FieldRow>
            )}

            {/* Webhook notification settings */}
            {notificationSettings.warningType === 'webhook' && (
              <>
                <FieldRow
                  label={t('Webhook地址')}
                  hint={t('只支持HTTPS，系统将以POST方式发送通知，请确保地址可以接收POST请求')}
                >
                  <TextField
                    placeholder={t('请输入Webhook地址，例如: https://example.com/webhook')}
                    value={notificationSettings.webhookUrl}
                    onChange={(val) => handleNotificationSettingChange('webhookUrl', val)}
                    prefix={<Link size={14} />}
                  />
                </FieldRow>

                <FieldRow
                  label={t('接口凭证')}
                  hint={t('密钥将以Bearer方式添加到请求头中，用于验证webhook请求的合法性')}
                >
                  <TextField
                    placeholder={t('请输入密钥')}
                    value={notificationSettings.webhookSecret}
                    onChange={(val) => handleNotificationSettingChange('webhookSecret', val)}
                    prefix={<Key size={14} />}
                  />
                </FieldRow>

                <FieldRow label={t('Webhook请求结构说明')}>
                  <div>
                    <div style={{ height: '200px', marginBottom: '12px' }}>
                      <CodeViewer
                        content={{
                          type: 'quota_exceed',
                          title: '额度预警通知',
                          content: '您的额度即将用尽，当前剩余额度为 {{value}}',
                          values: ['$0.99'],
                          timestamp: 1739950503,
                        }}
                        title='webhook'
                        language='json'
                      />
                    </div>
                    <div className='text-xs text-ui-text-2 leading-relaxed'>
                      <div><strong>type:</strong> {t('通知类型 (quota_exceed: 额度预警)')}</div>
                      <div><strong>title:</strong> {t('通知标题')}</div>
                      <div><strong>content:</strong> {t('通知内容，支持 {{value}} 变量占位符')}</div>
                      <div><strong>values:</strong> {t('按顺序替换content中的变量占位符')}</div>
                      <div><strong>timestamp:</strong> {t('Unix时间戳')}</div>
                    </div>
                  </div>
                </FieldRow>
              </>
            )}

            {/* Bark notification settings */}
            {notificationSettings.warningType === 'bark' && (
              <>
                <FieldRow
                  label={t('Bark推送URL')}
                  hint={t('支持HTTP和HTTPS，模板变量: {{title}} (通知标题), {{content}} (通知内容)')}
                >
                  <TextField
                    placeholder={t('请输入Bark推送URL，例如: https://api.day.app/yourkey/{{title}}/{{content}}')}
                    value={notificationSettings.barkUrl}
                    onChange={(val) => handleNotificationSettingChange('barkUrl', val)}
                    prefix={<Link size={14} />}
                  />
                </FieldRow>

                <div className='mt-3 p-4 bg-ui-bg-subtle/50 rounded-xl'>
                  <div className='text-sm text-ui-text mb-3'><strong>{t('模板示例')}</strong></div>
                  <div className='text-xs text-ui-text-2 font-mono bg-ui-bg-elevated p-3 rounded-lg shadow-sm mb-4'>
                    https://api.day.app/yourkey/{'{{title}}'}/{'{{content}}'}?sound=alarm&group=quota
                  </div>
                  <div className='text-xs text-ui-text-2 space-y-2'>
                    <div>• <strong>{'title'}:</strong> {t('通知标题')}</div>
                    <div>• <strong>{'content'}:</strong> {t('通知内容')}</div>
                    <div className='mt-3 pt-3 border-t border-gray-200'>
                      <span className='text-ui-text-3'>{t('更多参数请参考')}</span>{' '}
                      <a href='https://github.com/Finb/Bark' target='_blank' rel='noopener noreferrer' className='text-blue-500 hover:text-blue-600 font-medium'>
                        Bark {t('官方文档')}
                      </a>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Gotify notification settings */}
            {notificationSettings.warningType === 'gotify' && (
              <>
                <FieldRow
                  label={t('Gotify服务器地址')}
                  hint={t('支持HTTP和HTTPS，填写Gotify服务器的完整URL地址')}
                >
                  <TextField
                    placeholder={t('请输入Gotify服务器地址，例如: https://gotify.example.com')}
                    value={notificationSettings.gotifyUrl}
                    onChange={(val) => handleNotificationSettingChange('gotifyUrl', val)}
                    prefix={<Link size={14} />}
                  />
                </FieldRow>

                <FieldRow
                  label={t('Gotify应用令牌')}
                  hint={t('在Gotify服务器创建应用后获得的令牌，用于发送通知')}
                >
                  <TextField
                    placeholder={t('请输入Gotify应用令牌')}
                    value={notificationSettings.gotifyToken}
                    onChange={(val) => handleNotificationSettingChange('gotifyToken', val)}
                    prefix={<Key size={14} />}
                  />
                </FieldRow>

                <FieldRow
                  label={t('消息优先级')}
                  hint={t('消息优先级，范围0-10，默认为5')}
                >
                  <div style={{ maxWidth: '300px' }}>
                    <TextField
                      placeholder={t('请选择消息优先级')}
                      value={notificationSettings.gotifyPriority}
                      onChange={(val) => handleNotificationSettingChange('gotifyPriority', val)}
                      prefix={<Bell size={14} />}
                    />
                  </div>
                </FieldRow>

                <div className='mt-3 p-4 bg-ui-bg-subtle/50 rounded-xl'>
                  <div className='text-sm text-ui-text mb-3'><strong>{t('配置说明')}</strong></div>
                  <div className='text-xs text-ui-text-2 space-y-2'>
                    <div>1. {t('在Gotify服务器的应用管理中创建新应用')}</div>
                    <div>2. {t('复制应用的令牌（Token）并填写到上方的应用令牌字段')}</div>
                    <div>3. {t('填写Gotify服务器的完整URL地址')}</div>
                    <div className='mt-3 pt-3 border-t border-gray-200'>
                      <span className='text-ui-text-3'>{t('更多信息请参考')}</span>{' '}
                      <a href='https://gotify.net/' target='_blank' rel='noopener noreferrer' className='text-blue-500 hover:text-blue-600 font-medium'>
                        Gotify {t('官方文档')}
                      </a>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Pricing tab */}
        {activeTabKey === 'pricing' && (
          <div className='space-y-4'>
            <ToggleField
              label={t('接受未设置价格模型')}
              hint={t('当模型没有设置价格时仍接受调用，仅当您信任该网站时使用，可能会产生高额费用')}
              checked={!!notificationSettings.acceptUnsetModelRatioModel}
              onChange={(value) => handleNotificationSettingChange('acceptUnsetModelRatioModel', value)}
            />
          </div>
        )}

        {/* Privacy tab */}
        {activeTabKey === 'privacy' && (
          <div className='space-y-4'>
            <ToggleField
              label={t('记录请求与错误日志IP')}
              hint={t('开启后，仅"消费"和"错误"日志将记录您的客户端IP地址')}
              checked={!!notificationSettings.recordIpLog}
              onChange={(value) => handleNotificationSettingChange('recordIpLog', value)}
            />
          </div>
        )}

        {/* Sidebar tab */}
        {activeTabKey === 'sidebar' && hasSidebarSettingsPermission() && (
          <div className='space-y-4'>
            <div className='mb-4'>
              <span className='text-xs text-ui-text-2'>
                {t('您可以个性化设置侧边栏的要显示功能')}
              </span>
            </div>
            <div className='border border-ui-border rounded-xl p-4' style={{ backgroundColor: 'var(--page-bg)' }}>
              {sectionConfigs.map((section) => (
                <div key={section.key} className='mb-6 last:mb-0'>
                  {/* Section header with toggle */}
                  <div className='flex justify-between items-center mb-4 p-4 rounded-lg bg-ui-bg-subtle border border-ui-border'>
                    <div>
                      <div className='font-semibold text-base text-ui-text mb-1'>
                        {section.title}
                      </div>
                      <span className='text-xs text-ui-text-2'>
                        {section.description}
                      </span>
                    </div>
                    <Toggle
                      checked={sidebarModulesUser[section.key]?.enabled !== false}
                      onChange={handleSectionChange(section.key)}
                    />
                  </div>

                  {/* Module grid */}
                  <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
                    {section.modules
                      .filter((module) => isAllowedByAdmin(section.key, module.key))
                      .map((module) => (
                        <div
                          key={module.key}
                          className={`border border-ui-border rounded-xl p-4 hover:border-blue-300 transition-all duration-200 ${
                            sidebarModulesUser[section.key]?.enabled !== false ? '' : 'opacity-50'
                          }`}
                          style={{ backgroundColor: 'var(--page-bg)' }}
                        >
                          <div className='flex justify-between items-center h-full'>
                            <div className='flex-1 text-left'>
                              <div className='font-semibold text-sm text-ui-text mb-1'>
                                {module.title}
                              </div>
                              <span className='text-xs text-ui-text-2'>
                                {module.description}
                              </span>
                            </div>
                            <div className='ml-4'>
                              <Toggle
                                checked={sidebarModulesUser[section.key]?.[module.key] !== false}
                                onChange={handleModuleChange(section.key, module.key)}
                                disabled={sidebarModulesUser[section.key]?.enabled === false}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className='flex justify-end gap-3 px-4 py-3 border-t border-ui-border'>
        {activeTabKey === 'sidebar' ? (
          <>
            <button
              onClick={resetSidebarModules}
              className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors'
            >
              {t('重置为默认')}
            </button>
            <button
              onClick={saveSidebarSettings}
              disabled={sidebarLoading}
              className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover transition-colors disabled:opacity-50'
            >
              {sidebarLoading && <Loader2 size={14} className='animate-spin' />}
              {t('保存设置')}
            </button>
          </>
        ) : (
          <button
            onClick={handleSubmit}
            className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover transition-colors disabled:opacity-50'
          >
            {t('保存设置')}
          </button>
        )}
      </div>
    </div>
  );
};

export default NotificationSettings;

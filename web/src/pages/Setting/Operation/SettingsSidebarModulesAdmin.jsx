/*
 * 侧边栏模块管理（管理员） — token-system rewrite.
 */
import React, { useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { API, showSuccess, showError } from '../../../helpers';
import { StatusContext } from '../../../context/Status';
import { Toggle } from '../../../components/common/form/Primitives';

const DEFAULT_MODULES = {
  console: {
    enabled: true,
    playground: true,
    detail: true,
    token: true,
    log: true,
    midjourney: true,
    task: true,
  },
  personal: { enabled: true, topup: true, personal: true },
  admin: {
    enabled: true,
    channel: true,
    redemption: true,
    user: true,
    subscription: true,
    setting: true,
  },
};

export default function SettingsSidebarModulesAdmin(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [statusState, statusDispatch] = useContext(StatusContext);
  const [modules, setModules] = useState(DEFAULT_MODULES);

  useEffect(() => {
    if (props.options?.SidebarModulesAdmin) {
      try {
        setModules(JSON.parse(props.options.SidebarModulesAdmin));
      } catch {
        setModules(DEFAULT_MODULES);
      }
    }
  }, [props.options]);

  const setSection = (key) => (checked) =>
    setModules((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), enabled: checked },
    }));

  const setModule = (sectionKey, moduleKey) => (checked) =>
    setModules((prev) => ({
      ...prev,
      [sectionKey]: { ...(prev[sectionKey] || {}), [moduleKey]: checked },
    }));

  const reset = () => {
    setModules(DEFAULT_MODULES);
    showSuccess(t('已重置为默认配置'));
  };

  const submit = async () => {
    setLoading(true);
    try {
      const res = await API.put('/api/option/', {
        key: 'SidebarModulesAdmin',
        value: JSON.stringify(modules),
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('保存成功'));
        statusDispatch({
          type: 'set',
          payload: {
            ...statusState.status,
            SidebarModulesAdmin: JSON.stringify(modules),
          },
        });
        props.refresh && (await props.refresh());
      } else {
        showError(message);
      }
    } catch {
      showError(t('保存失败，请重试'));
    } finally {
      setLoading(false);
    }
  };

  const sectionConfigs = [
    {
      key: 'console',
      title: t('控制台区域'),
      description: t('数据管理和日志查看'),
      modules: [
        { key: 'playground', title: t('操练场'), description: t('AI 模型测试环境') },
        { key: 'detail', title: t('数据看板'), description: t('系统数据统计') },
        { key: 'token', title: t('令牌管理'), description: t('API 令牌管理') },
        { key: 'log', title: t('使用日志'), description: t('API 使用记录') },
      ],
    },
    {
      key: 'personal',
      title: t('个人中心区域'),
      description: t('用户个人功能'),
      modules: [
        { key: 'topup', title: t('钱包管理'), description: t('余额充值管理') },
        { key: 'personal', title: t('个人设置'), description: t('个人信息设置') },
      ],
    },
    {
      key: 'admin',
      title: t('管理员区域'),
      description: t('系统管理功能'),
      modules: [
        { key: 'channel', title: t('渠道管理'), description: t('API 渠道配置') },
        { key: 'subscription', title: t('订阅管理'), description: t('订阅套餐管理') },
        { key: 'redemption', title: t('兑换码管理'), description: t('兑换码生成管理') },
        { key: 'user', title: t('用户管理'), description: t('用户账户管理') },
        { key: 'setting', title: t('系统设置'), description: t('系统参数配置') },
      ],
    },
  ];

  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-2'>
        <div className='flex-1 min-w-0'>
          <div className='text-sm font-semibold text-ui-text'>
            {t('侧边栏管理（全局控制）')}
          </div>
          <div className='text-[11px] text-ui-text-3 mt-0.5'>
            {t('全局控制侧边栏区域和功能显示，管理员隐藏的功能用户无法启用')}
          </div>
        </div>
      </div>

      {sectionConfigs.map((section) => {
        const sectionEnabled = !!modules[section.key]?.enabled;
        return (
          <div key={section.key} className='space-y-3'>
            <div className='flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-ui-border bg-ui-bg-subtle'>
              <div className='flex-1 min-w-0'>
                <div className='text-sm font-semibold text-ui-text'>
                  {section.title}
                </div>
                <div className='text-[11px] text-ui-text-3 mt-0.5'>
                  {section.description}
                </div>
              </div>
              <Toggle checked={sectionEnabled} onChange={setSection(section.key)} />
            </div>
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 ${sectionEnabled ? '' : 'opacity-50 pointer-events-none'}`}
            >
              {section.modules.map((m) => (
                <div
                  key={m.key}
                  className='rounded-md border border-ui-border bg-ui-bg-subtle p-3 hover:border-ui-border-strong transition-colors'
                >
                  <div className='flex items-start justify-between gap-2'>
                    <div className='flex-1 min-w-0'>
                      <div className='text-xs font-semibold text-ui-text'>
                        {m.title}
                      </div>
                      <div className='text-[11px] text-ui-text-3 mt-1 leading-relaxed'>
                        {m.description}
                      </div>
                    </div>
                    <Toggle
                      checked={!!modules[section.key]?.[m.key]}
                      onChange={setModule(section.key, m.key)}
                      disabled={!sectionEnabled}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className='flex items-center justify-end gap-2 pt-2 border-t border-ui-divider'>
        <button
          type='button'
          onClick={reset}
          className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-ui-border text-ui-text-2 hover:bg-ui-bg-hover'
        >
          {t('重置为默认')}
        </button>
        <button
          type='button'
          onClick={submit}
          disabled={loading}
          className='inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md bg-ui-accent text-ui-accent-fg hover:opacity-90 disabled:opacity-50'
        >
          {t('保存设置')}
        </button>
      </div>
    </div>
  );
}

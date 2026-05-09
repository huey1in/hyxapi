/*
 * 顶栏模块管理 — token-system rewrite.
 */
import React, { useEffect, useState, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../../helpers';
import { StatusContext } from '../../../context/Status';
import { Toggle } from '../../../components/common/form/Primitives';

const DEFAULT_MODULES = {
  home: true,
  console: true,
  pricing: { enabled: true, requireAuth: false },
  docs: true,
  about: true,
};

export default function SettingsHeaderNavModules(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [statusState, statusDispatch] = useContext(StatusContext);
  const [modules, setModules] = useState(DEFAULT_MODULES);

  useEffect(() => {
    if (props.options?.HeaderNavModules) {
      try {
        const parsed = JSON.parse(props.options.HeaderNavModules);
        if (typeof parsed.pricing === 'boolean') {
          parsed.pricing = { enabled: parsed.pricing, requireAuth: false };
        }
        setModules(parsed);
      } catch {
        setModules(DEFAULT_MODULES);
      }
    }
  }, [props.options]);

  const setEnabled = (key) => (checked) => {
    setModules((prev) => {
      const next = { ...prev };
      if (key === 'pricing') {
        next.pricing = { ...(next.pricing || {}), enabled: checked };
      } else {
        next[key] = checked;
      }
      return next;
    });
  };

  const setPricingAuth = (checked) =>
    setModules((prev) => ({
      ...prev,
      pricing: { ...(prev.pricing || {}), requireAuth: checked },
    }));

  const reset = () => {
    setModules(DEFAULT_MODULES);
    showSuccess(t('已重置为默认配置'));
  };

  const submit = async () => {
    setLoading(true);
    try {
      const res = await API.put('/api/option/', {
        key: 'HeaderNavModules',
        value: JSON.stringify(modules),
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('保存成功'));
        statusDispatch({
          type: 'set',
          payload: {
            ...statusState.status,
            HeaderNavModules: JSON.stringify(modules),
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

  const configs = [
    { key: 'home', title: t('首页'), description: t('用户主页，展示系统信息') },
    { key: 'console', title: t('控制台'), description: t('用户控制面板，管理账户') },
    { key: 'pricing', title: t('模型广场'), description: t('模型定价，可选择是否需要登录访问') },
    { key: 'docs', title: t('文档'), description: t('系统文档和帮助信息') },
  ];

  return (
    <div className='space-y-4'>
      <div className='flex items-center gap-2'>
        <div className='flex-1 min-w-0'>
          <div className='text-sm font-semibold text-ui-text'>{t('顶栏管理')}</div>
          <div className='text-[11px] text-ui-text-3 mt-0.5'>
            {t('控制顶栏模块显示状态，全局生效')}
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'>
        {configs.map((m) => {
          const checked =
            m.key === 'pricing' ? !!modules.pricing?.enabled : !!modules[m.key];
          return (
            <div
              key={m.key}
              className='rounded-md border border-ui-border bg-ui-bg-subtle p-3 hover:border-ui-border-strong transition-colors'
            >
              <div className='flex items-start justify-between gap-2'>
                <div className='flex-1 min-w-0'>
                  <div className='text-xs font-semibold text-ui-text'>{m.title}</div>
                  <div className='text-[11px] text-ui-text-3 mt-1 leading-relaxed'>
                    {m.description}
                  </div>
                </div>
                <Toggle checked={checked} onChange={setEnabled(m.key)} />
              </div>
              {m.key === 'pricing' && checked && (
                <div className='mt-3 pt-3 border-t border-ui-divider flex items-start justify-between gap-2'>
                  <div className='flex-1 min-w-0'>
                    <div className='text-[11px] font-medium text-ui-text-2'>
                      {t('需要登录访问')}
                    </div>
                    <div className='text-[11px] text-ui-text-3 mt-0.5 leading-relaxed'>
                      {t('开启后未登录用户无法访问模型广场')}
                    </div>
                  </div>
                  <Toggle
                    checked={!!modules.pricing?.requireAuth}
                    onChange={setPricingAuth}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className='flex items-center justify-end gap-2 pt-2 border-t border-ui-divider'>
        <button
          type='button'
          onClick={reset}
          className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl border border-ui-border text-ui-text-2 hover:bg-ui-bg-hover'
        >
          {t('重置为默认')}
        </button>
        <button
          type='button'
          onClick={submit}
          disabled={loading}
          className='inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-xl bg-ui-accent text-ui-accent-fg hover:opacity-90 disabled:opacity-50'
        >
          {t('保存设置')}
        </button>
      </div>
    </div>
  );
}

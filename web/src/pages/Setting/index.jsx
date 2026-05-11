/*
 * Setting — 系统设置（6 个 Tab + 自适应 Option 编辑器）
 *
 * 通过 GET /api/option/ 拉全量配置，按 tab 前缀过滤后渲染对应输入控件
 * （Switch / NumberInput / Textarea / Input），逐条 PUT /api/option/ 保存。
 *
 * 不与 backup 的精细分卡 1:1，但提供完整的系统配置访问能力。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { usePageTitle } from '../../hooks/common/usePageTitle';
import { API, showError, showSuccess, isRoot } from '../../helpers';
import {
  Button, IconButton, Card, Input, NumberInput, Textarea, Switch, FieldRow, Loading, Notice,
} from '../../components/ui';
import { cn } from '../../components/ui/tokens';

const TABS = [
  { key: 'platform',    label: '平台设置',    prefixes: ['SystemName', 'Footer', 'HomePage', 'ServerAddress', 'WorkerUrl', 'WorkerValidKey', 'PriceUSDRate', 'QuotaPerUnit', 'DisplayInCurrency', 'DisplayTokenStatEnabled', 'CheckSensitiveEnabled', 'SelfUseModeEnabled', 'DemoSiteEnabled', 'Footer', 'Notice'] },
  { key: 'models',      label: '模型与定价',  prefixes: ['ModelRatio', 'GroupRatio', 'CompletionRatio', 'ChannelAffinity', 'GeminiModel', 'ClaudeModel', 'GrokModel', 'GlobalModel'] },
  { key: 'limits',      label: '限制与监控',  prefixes: ['QuotaForNewUser', 'QuotaForInviter', 'QuotaForInvitee', 'MaxConsumeQuotaPerDay', 'AutoDisableChannelEnabled', 'AutomaticEnableChannelEnabled', 'MonitoringRules', 'SensitiveWords', 'ModelRequestRateLimit', 'RateLimit', 'ChannelDisable'] },
  { key: 'dashboard',   label: '仪表盘内容',  prefixes: ['Announcements', 'FAQ', 'APIInfo', 'UptimeKuma', 'DataDashboard'] },
  { key: 'auth',        label: '用户认证',    prefixes: ['EmailVerification', 'PasswordLoginEnabled', 'PasswordRegisterEnabled', 'GitHubOAuthEnabled', 'GitHubClient', 'GoogleOAuthEnabled', 'WeChatAuthEnabled', 'LinuxDoOAuthEnabled', 'discord', 'OIDCEnabled', 'TurnstileEnabled', 'TurnstileSiteKey', 'TurnstileSecretKey', 'passkey', 'SMTP', 'RegisterEnabled', 'EmailDomain', 'EmailAlias'] },
  { key: 'performance', label: '性能',        prefixes: ['MemoryCacheEnabled', 'CacheRequestEnabled', 'BatchUpdate', 'GenRequestEnabled'] },
];

const LEGACY_KEY_MAP = { operation: 'platform', ratio: 'models', ratelimit: 'limits', system: 'auth', other: 'platform' };

const Setting = () => {
  const { t } = useTranslation();
  usePageTitle(t('系统设置'));
  const navigate = useNavigate();
  const location = useLocation();
  const [active, setActive] = useState('platform');
  const [options, setOptions] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchOptions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/option/');
      if (res.data?.success) {
        const map = {};
        (res.data.data || []).forEach((o) => { map[o.key] = o.value; });
        setOptions(map);
      } else showError(res.data?.message);
    } catch (e) { showError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    setActive(LEGACY_KEY_MAP[tab] || tab || 'platform');
  }, [location.search]);

  useEffect(() => { fetchOptions(); }, [fetchOptions]);

  const onChange = (k) => { setActive(k); navigate(`?tab=${k}`); };

  if (!isRoot()) {
    return (
      <div className='px-4 pt-8 pb-6 md:px-6 md:pt-10 md:pb-8' style={{ backgroundColor: 'var(--page-bg)' }}>
        <div className='max-w-[1400px] mx-auto py-16 text-center text-ui-text-3 text-sm'>{t('需要超级管理员权限')}</div>
      </div>
    );
  }

  return (
    <div className='px-4 pt-8 pb-6 md:px-6 md:pt-10 md:pb-8' style={{ backgroundColor: 'var(--page-bg)' }}>
      <div className='max-w-[1400px] mx-auto'>
        <div className='flex items-center justify-between gap-3 mb-5'>
          <h1 className='text-2xl md:text-3xl font-medium text-ui-text' style={{ letterSpacing: '-0.02em' }}>{t('系统设置')}</h1>
          <IconButton icon={RefreshCw} onClick={fetchOptions} disabled={loading} title={t('刷新')} className={loading ? '[&_svg]:animate-spin' : ''} />
        </div>

        <div className='border border-ui-border rounded-[20px] p-1 mb-4 overflow-x-auto' style={{ backgroundColor: 'var(--page-bg)' }}>
          <div className='flex items-center gap-1 min-w-max'>
            {TABS.map((tb) => {
              const isActive = active === tb.key;
              return (
                <button key={tb.key} type='button' onClick={() => onChange(tb.key)}
                  className={cn(
                    'flex-shrink-0 px-3 py-1.5 text-sm rounded-xl transition-colors',
                    isActive ? 'bg-ui-bg-subtle text-ui-text' : 'text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle/60',
                  )}>{t(tb.label)}</button>
              );
            })}
          </div>
        </div>

        {loading
          ? <div className='py-16 flex justify-center'><Loading label={t('加载中...')} /></div>
          : <TabContent tabKey={active} options={options} reload={fetchOptions} t={t} />}
      </div>
    </div>
  );
};

const TabContent = ({ tabKey, options, reload, t }) => {
  const tab = TABS.find((x) => x.key === tabKey);
  const keys = useMemo(() => {
    if (!tab) return [];
    return Object.keys(options).filter((k) => tab.prefixes.some((p) => k.startsWith(p))).sort();
  }, [tab, options]);

  if (!tab) return null;

  if (keys.length === 0) {
    return (
      <Card>
        <Notice kind='info'>{t('当前分组下没有可配置项，或后端未返回相关 Option。')}</Notice>
      </Card>
    );
  }

  return (
    <Card>
      <div className='mb-4'>
        <div className='text-sm font-semibold text-ui-text'>{t(tab.label)}</div>
        <div className='text-[11px] text-ui-text-3 mt-0.5'>{t('修改后点击 "保存" 立即生效')}</div>
      </div>
      <div className='space-y-3'>
        {keys.map((k) => <OptionRow key={k} optKey={k} optValue={options[k]} onSaved={reload} t={t} />)}
      </div>
    </Card>
  );
};

const isBool = (v) => v === 'true' || v === 'false';
const isJsonLike = (v) => typeof v === 'string' && (v.trim().startsWith('{') || v.trim().startsWith('['));
const isNumberLike = (v) => /^-?\d+(\.\d+)?$/.test(String(v ?? ''));

const OptionRow = ({ optKey, optValue, onSaved, t }) => {
  const [value, setValue] = useState(optValue);
  const [saving, setSaving] = useState(false);
  useEffect(() => setValue(optValue), [optValue]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await API.put('/api/option/', { key: optKey, value: String(value) });
      if (res.data?.success) { showSuccess(`${t('已保存')} ${optKey}`); onSaved(); }
      else showError(res.data?.message);
    } catch (e) { showError(e); }
    finally { setSaving(false); }
  };

  const renderInput = () => {
    if (isBool(optValue))      return <Switch checked={value === 'true'} onChange={(v) => setValue(v ? 'true' : 'false')} />;
    if (isJsonLike(optValue))  return <Textarea value={value || ''} onChange={setValue} rows={6} />;
    if (isNumberLike(optValue) && String(optValue).length < 16) return <NumberInput value={Number(value)} onChange={(v) => setValue(String(v))} />;
    return <Input value={value || ''} onChange={setValue} />;
  };

  return (
    <FieldRow label={optKey}>
      <div className='flex items-center gap-2'>
        <div className='flex-1'>{renderInput()}</div>
        <Button onClick={save} loading={saving}>{t('保存')}</Button>
      </div>
    </FieldRow>
  );
};

export default Setting;

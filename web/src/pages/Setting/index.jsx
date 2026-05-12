import React, { useEffect, useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';
import { API, showError, showSuccess, isRoot } from '../../helpers';
import {
  PageShell, Card, Button, IconButton, Input, NumberInput, Textarea, Switch, Tabs, Loading, EmptyState,
} from '../../components/ui';
import { Lock } from 'lucide-react';

const TABS = [
  { key: 'platform',    label: '平台' },
  { key: 'auth',        label: '认证' },
  { key: 'pricing',     label: '定价/分组' },
  { key: 'limits',      label: '限制' },
  { key: 'dashboard',   label: '仪表盘' },
  { key: 'performance', label: '性能' },
];

const TAB_KEYS = {
  platform: ['SystemName', 'ServerAddress', 'TopUpLink', 'ChatLink', 'Footer', 'Logo', 'HomePageContent'],
  auth: ['EmailVerificationEnabled', 'EmailDomainRestrictionEnabled', 'GitHubOAuthEnabled', 'GoogleOAuthEnabled', 'WeChatAuthEnabled', 'TurnstileCheckEnabled', 'RegisterEnabled', 'PasswordRegisterEnabled', 'PasswordLoginEnabled'],
  pricing: ['ModelRatio', 'CompletionRatio', 'GroupRatio', 'ModelPrice', 'UsergroupRatio'],
  limits: ['ChannelDisableThreshold', 'AutomaticDisableChannelEnabled', 'AutomaticEnableChannelEnabled', 'QuotaForNewUser', 'QuotaForInviter', 'QuotaForInvitee', 'PreConsumedQuota'],
  dashboard: ['DataExportEnabled', 'DataExportInterval', 'DataExportDefaultTime', 'LogConsumeEnabled'],
  performance: ['StreamCacheQueueLength', 'BatchUpdateEnabled', 'BatchUpdateInterval', 'MemoryCacheEnabled', 'CacheKeyPrefix'],
};

const MULTILINE_KEYS = new Set(['HomePageContent', 'Footer']);
const JSON_KEYS = new Set(['ModelRatio', 'CompletionRatio', 'GroupRatio', 'ModelPrice', 'UsergroupRatio']);
const BOOL_KEYS = new Set([
  'EmailVerificationEnabled', 'EmailDomainRestrictionEnabled',
  'GitHubOAuthEnabled', 'GoogleOAuthEnabled', 'WeChatAuthEnabled',
  'TurnstileCheckEnabled', 'RegisterEnabled', 'PasswordRegisterEnabled', 'PasswordLoginEnabled',
  'AutomaticDisableChannelEnabled', 'AutomaticEnableChannelEnabled',
  'DataExportEnabled', 'LogConsumeEnabled',
  'BatchUpdateEnabled', 'MemoryCacheEnabled',
]);
const NUMBER_KEYS = new Set([
  'ChannelDisableThreshold',
  'QuotaForNewUser', 'QuotaForInviter', 'QuotaForInvitee', 'PreConsumedQuota',
  'DataExportInterval', 'StreamCacheQueueLength', 'BatchUpdateInterval',
]);

const toBool = (v) => v === true || v === 'true' || v === '1';

const JSONField = ({ value, onChange }) => {
  const [err, setErr] = useState(null);
  const validate = (v) => {
    if (!v?.trim()) { setErr(null); return; }
    try { JSON.parse(v); setErr(null); } catch (e) { setErr(e.message); }
  };
  const format = () => {
    try {
      const obj = JSON.parse(value || '{}');
      onChange(JSON.stringify(obj, null, 2));
      setErr(null);
    } catch (e) { setErr(e.message); }
  };
  useEffect(() => { validate(value); }, [value]);
  return (
    <div>
      <Textarea value={value} onChange={onChange} rows={8} className='font-mono text-xs' />
      <div className='flex items-center justify-between mt-1'>
        <span className={`text-xs ${err ? 'text-ui-danger' : 'text-ui-text-3'}`}>
          {err ? `JSON 错误: ${err}` : 'JSON 格式正确'}
        </span>
        <Button size='sm' variant='toggle' onClick={format} disabled={!!err}>格式化</Button>
      </div>
    </div>
  );
};

const SettingPage = () => {
  const root = isRoot();
  const [active, setActive] = useState('platform');
  const [options, setOptions] = useState({});
  const [dirty, setDirty] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await API.get('/api/option/');
      if (data.success) {
        const map = {};
        (data.data || []).forEach((it) => { map[it.key] = it.value; });
        setOptions(map);
        setDirty({});
      } else showError(data.message);
    } catch (e) { showError(e); } finally { setLoading(false); }
  };
  useEffect(() => { if (root) load(); else setLoading(false); }, []);

  if (!root) {
    return (
      <PageShell title='系统设置'>
        <EmptyState icon={Lock} title='无权访问' description='仅超级管理员可访问系统设置' />
      </PageShell>
    );
  }

  const set = (k, v) => setDirty((p) => ({ ...p, [k]: v }));
  const val = (k) => (dirty[k] !== undefined ? dirty[k] : (options[k] ?? ''));

  const save = async () => {
    const keys = Object.keys(dirty);
    if (keys.length === 0) return showSuccess('无变更');
    setSaving(true);
    try {
      for (const k of keys) {
        const v = String(dirty[k] ?? '');
        const { data } = await API.put('/api/option/', { key: k, value: v });
        if (!data.success) { showError(`${k}: ${data.message}`); return; }
      }
      showSuccess('已保存');
      load();
    } catch (e) { showError(e); } finally { setSaving(false); }
  };

  const keys = TAB_KEYS[active] || [];

  return (
    <PageShell
      title='系统设置'
      actions={
        <>
          <IconButton icon={RefreshCw} title='刷新' onClick={load} />
          <Button icon={Save} loading={saving} onClick={save} disabled={Object.keys(dirty).length === 0}>
            保存{Object.keys(dirty).length > 0 ? ` (${Object.keys(dirty).length})` : ''}
          </Button>
        </>
      }
    >
      <div className='mb-4'>
        <Tabs
          items={TABS.map((t) => ({ value: t.key, label: t.label }))}
          value={active}
          onChange={setActive}
        />
      </div>

      {loading ? <Loading /> : (
        <Card>
          <div className='space-y-4'>
            {keys.map((k) => (
              <div key={k} className='grid grid-cols-1 md:grid-cols-[260px_1fr] gap-3 md:gap-6 md:items-start'>
                <label className='text-sm text-ui-text-1 font-mono pt-2'>{k}</label>
                {BOOL_KEYS.has(k)
                  ? <div className='pt-1.5'><Switch checked={toBool(val(k))} onChange={(v) => set(k, v ? 'true' : 'false')} /></div>
                  : NUMBER_KEYS.has(k)
                    ? <NumberInput value={Number(val(k)) || 0} onChange={(v) => set(k, String(v ?? 0))} />
                    : JSON_KEYS.has(k)
                      ? <JSONField value={val(k)} onChange={(v) => set(k, v)} />
                      : MULTILINE_KEYS.has(k)
                        ? <Textarea value={val(k)} onChange={(v) => set(k, v)} rows={4} />
                        : <Input value={val(k)} onChange={(e) => set(k, e.target.value)} />}
              </div>
            ))}
          </div>
        </Card>
      )}
    </PageShell>
  );
};

export default SettingPage;

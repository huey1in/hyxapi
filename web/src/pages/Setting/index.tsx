import { LayoutSkeleton } from '../../components/ui/feedback/ContentSkeleton';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Lock, RefreshCw, Save } from 'lucide-react';
import { API } from '../../helpers';
import PaymentSetup from '../../features/payments/PaymentSetup';
import { remainingSettingDrafts } from '../../features/payments/payment-setup-data';
import {
  PageShell,
  Button,
  IconButton,
  Input,
  NumberInput,
  Textarea,
  Switch,
  Tabs,
  EmptyState,
  Select,
  TagInput,
  showError,
} from '../../components/ui';
import ModelPricingEditor from './ModelPricingEditor';
import PermissionEditor from './PermissionEditor';
import TaskPluginManager from './TaskPluginManager';
import CheckinSetup from './CheckinSetup';
import SiteSettings from './SiteSettings';
import SiteNoticeEditor from './SiteNoticeEditor';
import GroupPricingRules from './GroupPricingRules';
import { groupPricingRuleKeys } from './group-pricing-rules';
import { useAuthStore } from '../../stores/auth-store';
import {
  quotaToDisplayAmount,
  displayAmountToQuota,
} from '../../helpers/quota';
import { apiErrorMessage } from '../../lib/api-error';
import {
  isRequestPolicyKey,
  TABS,
  TAB_KEYS,
  TAB_SECTIONS,
  WIDE_KEYS,
  MULTILINE_KEYS,
  TAG_KEYS,
  JSON_ARRAY_TAG_KEYS,
  NEWLINE_TAG_KEYS,
  JSON_KEYS,
  RAW_JSON_KEYS,
  POLICY_KEYS,
  LIST_EDITOR_KEYS,
  BOOL_KEYS,
  NUMBER_KEYS,
  LABELS,
  SELECT_OPTIONS,
} from './setting-fields';
import type { SettingSection } from './setting-fields';
import {
  invalidSettingKeys,
  optionsSchema,
  policySchema,
  parseSettingReply,
  parseJSON,
  validNumericSetting,
} from './setting-data';
import type { Settings } from './setting-data';
import {
  SettingsDraftContext,
  RatioEditor,
  GroupRatioEditor,
  PolicyEditor,
  RawJSONEditor,
  AffinityRulesEditor,
  ListEditor,
  EmailTemplateEditor,
  emailTemplateKeys,
} from './SettingEditors';
import type { EditorCache } from './SettingEditors';
import SettingsSave, { settingsRequestConfig } from './SettingsSave';
import EmailTest from './EmailTest';

const toBool = (value: string) => value === 'true' || value === '1';
function SettingPageContent() {
  const { t } = useTranslation();
  const root = useAuthStore((state) => state.auth.user?.role === 100);
  const read = useRef<AbortController | null>(null);
  const drafts = useRef<EditorCache>(new Map());
  const [, notifyDrafts] = useState(0);
  const changed = useCallback(() => notifyDrafts((value) => value + 1), []);
  const draftContext = useMemo(
    () => ({ cache: drafts.current, changed }),
    [changed],
  );
  const [epoch, setEpoch] = useState(0);
  const [active, setActive] = useState('platform');
  const [options, setOptions] = useState<Settings>({});
  const [dirty, setDirty] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [policyError, setPolicyError] = useState('');
  const [modelList, setModelList] = useState<string[]>([]);
  const [groupList, setGroupList] = useState<string[]>([]);
  const [saveRequest, setSaveRequest] = useState<{
    changes: Settings;
    stored: Settings;
  } | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const saving = saveRequest !== null;
  const ack = (persisted: Settings, canonical: Settings = persisted) => {
    setOptions((current) => ({ ...current, ...canonical }));
    setDirty((pending) => remainingSettingDrafts(pending, persisted));
  };
  const load = async (reset = false, persisted: Settings = {}) => {
    read.current?.abort();
    const owner = new AbortController();
    read.current = owner;
    const signal = owner.signal;
    setLoading(true);
    setLoadError('');
    const get = async <T extends z.ZodType>(
      url: string,
      schema: T,
    ): Promise<z.output<T>> => {
      const { data } = await API.get(url, { ...settingsRequestConfig, signal });
      signal.throwIfAborted();
      return parseSettingReply(data, schema);
    };
    const results = await Promise.allSettled([
      get('/api/option/', optionsSchema),
      get('/api/option/request_policy', policySchema),
      get('/api/channel/models_enabled', z.array(z.string())),
      get('/api/group/', z.array(z.string())),
    ]);
    if (signal.aborted) return;
    const [loaded, policy, models, groups] = results;
    if (loaded.status === 'rejected')
      setLoadError(
        apiErrorMessage(loaded.reason, 'Unable to load settings') ||
          'Unable to load settings',
      );
    else {
      setPolicyError(
        policy.status === 'rejected'
          ? 'Unable to load request policy. Retry before editing request policy settings.'
          : '',
      );
      setOptions({
        ...loaded.value,
        ...(policy.status === 'fulfilled' ? policy.value.options : {}),
      });
      if (reset) {
        drafts.current.clear();
        setEpoch((value) => value + 1);
        setDirty({});
      } else setDirty((pending) => remainingSettingDrafts(pending, persisted));
      setModelList(models.status === 'fulfilled' ? models.value : []);
      setGroupList(groups.status === 'fulfilled' ? groups.value : []);
    }
    setLoading(false);
  };
  useEffect(() => {
    if (root) void load();
    else setLoading(false);
    return () => read.current?.abort();
  }, [root]);
  const set = (key: string, value: string) =>
    setDirty((pending) => {
      const next = { ...pending };
      if (options[key] === value) delete next[key];
      else next[key] = value;
      return next;
    });
  const val = (key: string): string =>
    dirty[key] ??
    options[key] ??
    (groupPricingRuleKeys.some((item) => item === key) ? '{}' : '');
  const invalidDrafts = [...drafts.current.entries()]
    .filter(([, entry]) => entry.invalid)
    .map(([key]) => key);
  const save = () => {
    const invalid = [...invalidSettingKeys(dirty, options), ...invalidDrafts];
    if (invalid.length) {
      showError(
        t(
          'Correct invalid settings before saving. Drafts are kept when switching tabs.',
        ),
      );
      return;
    }
    if (policyError && Object.keys(dirty).some(isRequestPolicyKey)) {
      showError(t(policyError));
      return;
    }
    if (Object.keys(dirty).length)
      setSaveRequest({ changes: { ...dirty }, stored: { ...options } });
  };
  if (!root)
    return (
      <PageShell title={t('System settings')}>
        <EmptyState
          icon={Lock}
          title={t('Access denied')}
          description={t(
            'Only the root administrator can access system settings',
          )}
        />
      </PageShell>
    );

  const renderField = (key: string) => {
    if (key === 'Notice')
      return (
        <div key={key} style={{ gridColumn: '1 / -1', minWidth: 0 }}>
          <SiteNoticeEditor
            value={val(key)}
            onChange={(value) => set(key, value)}
            disabled={saving}
          />
        </div>
      );
    const label = t(LABELS[key] || key);
    const id = `setting-${key}`;
    if (BOOL_KEYS.has(key))
      return (
        <div
          key={key}
          className="flex items-center justify-between gap-3"
          style={{ gridColumn: '1 / -1' }}
        >
          <label htmlFor={id} className="text-sm text-ui-text">
            {label}
            {key === 'twofa.enabled' && <span className='mt-1 block text-xs text-ui-text-3'>{t('Hide client settings and prevent new setup when disabled. Existing accounts still require their verification codes.')}</span>}
          </label>
          <Switch
            id={id}
            aria-label={label}
            disabled={Boolean(policyError && isRequestPolicyKey(key))}
            checked={toBool(val(key))}
            onChange={(value) => set(key, String(value))}
          />
        </div>
      );
    const wide =
      WIDE_KEYS.has(key) ||
      TAG_KEYS.has(key) ||
      JSON_KEYS.has(key) ||
      RAW_JSON_KEYS.has(key) ||
      POLICY_KEYS.has(key) ||
      LIST_EDITOR_KEYS.has(key);
    const numeric =
      val(key).trim() && Number.isFinite(Number(val(key)))
        ? Number(val(key))
        : '';
    const tags = JSON_ARRAY_TAG_KEYS.has(key)
      ? parseJSON(val(key) || '[]', z.array(z.string()))
      : val(key)
          .split(NEWLINE_TAG_KEYS.has(key) ? '\n' : ',')
          .filter(Boolean);
    return (
      <div
        key={key}
        style={wide ? { gridColumn: '1 / -1', minWidth: 0 } : { minWidth: 0 }}
      >
        <label htmlFor={id} className="mb-[5px] block text-xs text-ui-text-3">
          {label}
        </label>
        <fieldset
          disabled={Boolean(policyError && isRequestPolicyKey(key))}
          className="min-w-0"
        >
          {SELECT_OPTIONS[key] ? (
            <Select
              aria-label={label}
              value={val(key)}
              options={SELECT_OPTIONS[key].map((option) => ({
                ...option,
                label: t(option.label),
              }))}
              onChange={(value) => set(key, value)}
            />
          ) : key === 'QuotaRemindThreshold' ? (
            <NumberInput
              id={id}
              aria-label={label}
              min={0}
              step="any"
              value={numeric === '' ? '' : quotaToDisplayAmount(numeric)}
              onChange={(value) =>
                set(
                  key,
                  value === '' ? '' : String(displayAmountToQuota(value)),
                )
              }
            />
          ) : NUMBER_KEYS.has(key) ? (
            <NumberInput
              id={id}
              aria-label={label}
              invalid={
                Object.hasOwn(dirty, key) && !validNumericSetting(key, val(key))
              }
              value={numeric}
              onChange={(value) => set(key, String(value))}
            />
          ) : JSON_KEYS.has(key) ? (
            <RatioEditor
              configKey={key}
              value={val(key)}
              onChange={(value) => set(key, value)}
              numericValue={
                ![
                  'UserUsableGroups',
                  'gemini.safety_settings',
                  'gemini.version_settings',
                ].includes(key)
              }
            />
          ) : RAW_JSON_KEYS.has(key) ? (
            key === 'channel_affinity_setting.rules' ? (
              <AffinityRulesEditor
                value={val(key)}
                onChange={(value) => set(key, value)}
              />
            ) : (
              <RawJSONEditor
                configKey={key}
                value={val(key)}
                onChange={(value) => set(key, value)}
              />
            )
          ) : POLICY_KEYS.has(key) ? (
            <PolicyEditor
              value={val(key)}
              onChange={(value) => set(key, value)}
            />
          ) : LIST_EDITOR_KEYS.has(key) ? (
            <ListEditor
              configKey={key}
              value={val(key)}
              onChange={(value) => set(key, value)}
            />
          ) : TAG_KEYS.has(key) ? (
            tags === null ? (
              <RawJSONEditor
                configKey={key}
                value={val(key)}
                schema={z.array(z.string())}
                onChange={(value) => set(key, value)}
              />
            ) : (
              <TagInput
                value={tags}
                onChange={(values) =>
                  set(
                    key,
                    JSON_ARRAY_TAG_KEYS.has(key)
                      ? JSON.stringify(values)
                      : values.join(NEWLINE_TAG_KEYS.has(key) ? '\n' : ','),
                  )
                }
              />
            )
          ) : MULTILINE_KEYS.has(key) ? (
            emailTemplateKeys.has(key) ? (
              <EmailTemplateEditor
                configKey={key}
                value={val(key)}
                onChange={(value) => set(key, value)}
              />
            ) : (
              <Textarea
                id={id}
                aria-label={label}
                value={val(key)}
                onChange={(value) => set(key, value)}
                rows={12}
              />
            )
          ) : (
            <Input
              id={id}
              aria-label={label}
              type={key === 'WorkerValidKey' ? 'password' : 'text'}
              value={val(key)}
              onChange={(value) => set(key, value)}
            />
          )}
        </fieldset>
        {key === 'WorkerValidKey' && (
          <p className="mt-1 text-xs text-ui-text-3">
            {t(
              'Saved verification keys are hidden. Enter a new key to replace the saved value.',
            )}
          </p>
        )}
      </div>
    );
  };
  const renderSection = (
    title: string,
    keys: string[],
    section?: SettingSection,
  ) => {
    if (section?.component === 'GroupPricingRules')
      return (
        <GroupPricingRules
          key={title}
          value={val}
          onChange={set}
          disabled={saving}
        />
      );
    if (section?.component === 'SiteSettings')
      return (
        <SiteSettings
          key={title}
          value={val}
          onChange={set}
          disabled={saving}
        />
      );
    if (section?.component === 'CheckinSetup')
      return <CheckinSetup key={title} value={val} onChange={set} />;
    if (section?.component === 'PaymentSetup')
      return (
        <PaymentSetup
          key={title}
          value={val}
          onChange={set}
          disabled={saving}
          onBusyChange={setPaymentBusy}
          onConfirmed={(persisted) => {
            ack(persisted);
            return load(false, persisted);
          }}
        />
      );
    const component = section?.component;
    const gate = section?.gateKey;
    const visible =
      gate && !toBool(val(gate)) ? keys.filter((key) => key === gate) : keys;
    return (
      <section
        key={title}
        className="min-w-0 rounded-[26px] border border-ui-border px-[22px] py-5"
      >
        {component !== 'ModelPricingEditor' && (
          <h2 className="mb-4 text-[15px] font-semibold text-ui-text">
            {t(title)}
          </h2>
        )}
        {component === 'ModelPricingEditor' ? (
          <ModelPricingEditor modelSuggestions={modelList} />
        ) : component === 'PermissionEditor' ? (
          <PermissionEditor />
        ) : component === 'GroupRatioEditor' ? (
          <GroupRatioEditor
            values={Object.fromEntries(keys.map((key) => [key, val(key)]))}
            onChange={set}
            suggestions={groupList}
          />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fill, minmax(min(280px, 100%), 1fr))',
              gap: 14,
            }}
          >
            {visible.map(renderField)}
          </div>
        )}
        {title === '邮箱验证' && <EmailTest disabled={saving} />}
      </section>
    );
  };
  const sections = TAB_SECTIONS[active];
  const count = Object.keys(dirty).length;
  return (
    <SettingsDraftContext.Provider value={draftContext}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          width: '100%',
          minWidth: 0,
          maxWidth: 960,
          marginInline: 'auto',
          padding: '24px 16px',
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold text-ui-text">
            {t('System settings')}
          </h1>
          <div className="flex gap-1.5">
            <IconButton
              icon={RefreshCw}
              title={t('Refresh')}
              disabled={loading || saving || paymentBusy}
              onClick={() => void load(true)}
            />
            <Button
              icon={Save}
              loading={saving}
              onClick={save}
              disabled={
                loading ||
                saving ||
                paymentBusy ||
                Boolean(loadError) ||
                (count === 0 && invalidDrafts.length === 0)
              }
            >
              {t('Save')}
              {count > 0 ? ` (${count})` : ''}
            </Button>
          </div>
        </div>
        <div className="min-w-0 overflow-x-auto">
          <div className="min-w-max">
            <Tabs
              items={TABS.map((tab) => ({
                value: tab.key,
                label: t(tab.label),
              }))}
              value={active}
              onChange={setActive}
            />
          </div>
        </div>
        {policyError && !loading && !loadError && (
          <div
            role="alert"
            className="space-y-2 rounded-2xl border border-ui-border p-4"
          >
            <p className="text-sm text-ui-text-2">{t(policyError)}</p>
            <Button
              disabled={saving || paymentBusy}
              onClick={() => void load()}
            >
              {t('Retry')}
            </Button>
          </div>
        )}
        {loadError ? (
          <div
            role="alert"
            className="space-y-3 rounded-2xl border border-ui-border p-5"
          >
            <p className="text-sm text-ui-text-2">{t(loadError)}</p>
            <Button onClick={() => void load()}>{t('Retry')}</Button>
          </div>
        ) : (
          <LayoutSkeleton loading={loading}>
            <fieldset key={epoch} disabled={saving || loading} className="min-w-0 space-y-5">
              {active === 'plugins' ? (
                <>
                  {renderSection('任务插件', ['TaskPluginEnabled'])}
                  <TaskPluginManager />
                </>
              ) : sections ? (
                sections.map((section) =>
                  renderSection(section.title, section.keys, section),
                )
              ) : (
                renderSection(
                  TABS.find((tab) => tab.key === active)?.label || active,
                  TAB_KEYS[active] || [],
                )
              )}
            </fieldset>
          </LayoutSkeleton>
        )}
        {saveRequest && (
          <SettingsSave
            changes={saveRequest.changes}
            stored={saveRequest.stored}
            onAck={ack}
            onClose={() => setSaveRequest(null)}
          />
        )}
      </div>
    </SettingsDraftContext.Provider>
  );
}
export default function SettingPage() {
  const identity = useAuthStore(
    (state) =>
      `${state.auth.user?.id}:${state.auth.session?.sid}:${state.auth.user?.role}`,
  );
  return <SettingPageContent key={identity} />;
}

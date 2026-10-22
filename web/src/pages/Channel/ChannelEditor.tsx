import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { showError, showSuccess, getChannelModels } from '../../helpers';
import {
  Button,
  Input,
  NumberInput,
  Select,
  MultiSelect,
  Textarea,
  SlideOver,
  Switch,
} from '../../components/ui';
import { CHANNEL_TYPE_OPTIONS as TYPE_OPTIONS } from '../../constants/channel-types';
import { MODEL_FETCHABLE_CHANNEL_TYPES } from '../../constants/channel.constants';
import { useAuthStore } from '../../stores/auth-store';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { hasPermission } from '../../lib/admin-permissions';
import { apiErrorMessage } from '../../lib/api-error';
import {
  CHANNEL_KEY_HINTS,
  CHANNEL_OTHER_FIELDS,
  channelCredentialError,
  isMultiKeyChannel,
} from './provider-form';
import type { ChannelCreateMode } from './provider-form';
import {
  createChannelDraft,
  serializeChannelDraft,
  pluginOptionsSchema,
} from './channel-data';
import type {
  EditingChannel,
  ChannelDraft,
  ChannelSetting,
  ChannelOther,
} from './channel-data';
import { channelRequest } from './channel-query';
import {
  Field,
  Section,
  ModelTagList,
  KeyValueEditor,
  MULTI_KEY_MODE_OPTIONS,
} from './ChannelFormParts';
import ModelMappingEditor from './ModelMappingEditor';
import { validateModelMappingJson } from './model-mapping-validation';
import TransportSettings from './TransportSettings';
function ChannelEditForm({
  channel,
  onClose,
  onSaved,
}: {
  channel: EditingChannel;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t: translate } = useTranslation();
  const user = useAuthStore((state) => state.auth.user);
  const sid = useAuthStore((state) => state.auth.session?.sid);
  const identity = `${user?.id}:${sid}:${user?.role}`;
  const canBindPlugin =
    hasPermission(user, 'task_plugin', 'bind') &&
    hasPermission(user, 'channel', 'sensitive_write');
  const isEdit = !!channel.id;
  const editLifetime = useRef<AbortController | null>(null);
  const [form, setForm] = useState<ChannelDraft>(() =>
    createChannelDraft(channel),
  );
  const [mode, setMode] = useState<ChannelCreateMode>('single');
  const [batchPrefix, setBatchPrefix] = useState(false);
  const [customModel, setCustomModel] = useState('');
  const { busy: saving, run: saveOperation } = useOwnedOperation();
  const { busy: fetchingModels, run: fetchOperation } = useOwnedOperation();
  const [mappingValid, setMappingValid] = useState(true);
  const [upstreamModels, setUpstreamModels] = useState<string[]>([]);
  const groups = useQuery({
    queryKey: ['channel-editor-groups', identity],
    gcTime: 0,
    retry: false,
    queryFn: ({ signal }) =>
      channelRequest('get', '/api/group/', z.array(z.string()), signal),
  });
  const defaults = useQuery({
    queryKey: ['channel-editor-default-urls', identity],
    gcTime: 0,
    retry: false,
    queryFn: ({ signal }) =>
      channelRequest(
        'get',
        '/api/channel/default_base_urls',
        z.record(z.string(), z.string()),
        signal,
      ),
  });
  const plugins = useQuery({
    queryKey: ['channel-editor-plugins', identity, form.type],
    enabled: [60, 61].includes(form.type) && canBindPlugin,
    gcTime: 0,
    retry: false,
    queryFn: ({ signal }) =>
      channelRequest(
        'get',
        '/api/task_plugin_options',
        pluginOptionsSchema,
        signal,
      ),
  });
  const groupOptions = [
    ...new Set([
      ...(groups.isError ? [] : (groups.data ?? [])),
      ...(form.group ?? '').split(',').filter(Boolean),
    ]),
  ].map((value) => ({ value, label: value }));
  const testModels = [...new Set([
    ...(form.models || '').split(',').map((model) => model.trim()).filter(Boolean),
    ...(form.test_model ? [form.test_model] : []),
  ])];
  const defaultBaseURLs = defaults.isError ? {} : (defaults.data ?? {});
  const taskPlugins = plugins.isError ? [] : (plugins.data ?? []);
  const pluginOptionsError = plugins.isError
    ? translate(
        apiErrorMessage(plugins.error, 'Unable to load bindable plugins'),
      )
    : '';
  const [advancedRoutesJSON, setAdvancedRoutesJSON] = useState(() =>
    form.other_settings.advanced_custom
      ? JSON.stringify(form.other_settings.advanced_custom, null, 2)
      : '',
  );
  useEffect(() => {
    const controller = new AbortController();
    editLifetime.current = controller;
    return () => {
      controller.abort();
      if (editLifetime.current === controller) editLifetime.current = null;
    };
  }, [
    user?.id,
    channel.id,
    form.type,
    form.key,
    form.base_url,
    form.header_override,
    form.setting.proxy,
    advancedRoutesJSON,
  ]);
  const isAdvanced = [58, 62, 63].includes(Number(form.type));
  const u =
    <K extends keyof ChannelDraft>(key: K) =>
    (value: ChannelDraft[K]) =>
      setForm((current) => ({ ...current, [key]: value }));
  const uSetting =
    <K extends keyof ChannelSetting>(key: K) =>
    (value: ChannelSetting[K]) =>
      setForm((current) => ({
        ...current,
        setting: { ...current.setting, [key]: value },
      }));
  const uOther =
    <K extends keyof ChannelOther>(key: K) =>
    (value: ChannelOther[K]) =>
      setForm((current) => ({
        ...current,
        other_settings: { ...current.other_settings, [key]: value },
      }));
  const changeType = (value: number) => {
    if (Number(value) === 57) setMode('single');
    setForm((current) => {
      const setting = { ...current.setting };
      delete setting.task_plugin_key;
      delete setting.task_extend_plugin_keys;
      return { ...current, type: Number(value), setting };
    });
  };
  const selectPlugin = (key: string) =>
    setForm((current) => {
      const plugin = taskPlugins.find((item) => item.key === key);
      return {
        ...current,
        setting: { ...current.setting, task_plugin_key: key },
        base_url: current.base_url || plugin?.baseUrl || '',
        models: current.models || plugin?.models?.join(',') || '',
      };
    });

  const save = () =>
    void saveOperation(async (signal) => {
      if (
        !mappingValid ||
        !validateModelMappingJson(form.model_mapping || '').valid
      )
        throw new Error('请先修复模型映射配置');
      if (form.type === 61 && !form.setting.task_plugin_key)
        throw new Error('请选择任务插件');
      const credentialError = channelCredentialError(
        form.type,
        form.key,
        mode,
        isEdit,
      );
      if (credentialError) throw new Error(credentialError);
      if ([3, 18, 21, 39, 41, 49].includes(form.type) && !form.other?.trim())
        throw new Error('Complete the provider-specific configuration');
      const payload = serializeChannelDraft(form, channel, advancedRoutesJSON);
      if (isEdit)
        await channelRequest(
          'put',
          '/api/channel/',
          z.unknown(),
          signal,
          payload,
        );
      else
        await channelRequest('post', '/api/channel/', z.unknown(), signal, {
          mode,
          multi_key_mode:
            mode === 'multi_to_single' ? form.multi_key_mode : undefined,
          batch_add_set_key_prefix_2_name:
            mode === 'batch' ? batchPrefix : undefined,
          channel: payload,
        });
      showSuccess(
        translate(isEdit ? translate('已更新') : translate('已创建')),
      );
      onSaved();
    });
  const loadUpstreamModels = async (
    signal: AbortSignal | undefined = editLifetime.current?.signal,
  ): Promise<string[]> => {
    if (!signal) throw new DOMException('Cancelled', 'AbortError');
    const owner = editLifetime.current;
    if (!owner) throw new DOMException('Cancelled', 'AbortError');
    signal = AbortSignal.any([owner.signal, signal]);
    let models: string[];
    if (isEdit && !isAdvanced)
      models = await channelRequest(
        'get',
        `/api/channel/fetch_models/${channel.id}`,
        z.array(z.string()),
        signal,
      );
    else {
      const key = form.key.trim();
      if (!key && !(isEdit && isAdvanced)) throw new Error('请先填入密钥');
      models = await channelRequest(
        'post',
        '/api/channel/fetch_models',
        z.array(z.string()),
        signal,
        {
          base_url: form.base_url?.trim() || '',
          type: form.type,
          key,
          ...(isAdvanced
            ? {
                channel_id: isEdit ? channel.id : undefined,
                advanced_custom:
                  form.type === 58
                    ? advancedRoutesJSON.trim() || undefined
                    : undefined,
                header_override: form.header_override || '',
                proxy: form.setting.proxy || '',
              }
            : {}),
        },
      );
    }
    signal.throwIfAborted();
    setUpstreamModels(models);
    return models;
  };
  const fetchModels = () =>
    void fetchOperation(async (signal) => {
      const models = await loadUpstreamModels(signal);
      signal.throwIfAborted();
      setForm((current) => ({ ...current, models: models.join(',') }));
      showSuccess(translate('已从上游获取模型列表'));
    });
  const addCustomModel = () => {
    if (!customModel.trim()) return;
    const current = form.models
      ? form.models
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    if (!current.includes(customModel.trim())) {
      current.push(customModel.trim());
      setForm((p) => ({ ...p, models: current.join(',') }));
    }
    setCustomModel('');
  };

  const clearModels = () => setForm((p) => ({ ...p, models: '' }));

  const fillDefaultModels = () => {
    const defaults =
      Number(form.type) === 61
        ? taskPlugins.find(
            (plugin) => plugin.key === form.setting?.task_plugin_key,
          )?.models
        : getChannelModels(form.type);
    if (defaults && defaults.length > 0) {
      setForm((p) => ({ ...p, models: defaults.join(',') }));
    } else {
      showError(translate('该类型暂无默认模型列表'));
    }
  };

  const fetchModelsFromUrl = fetchModels;

  useEffect(() => {
    if (channel.fetchModelsOnOpen) fetchModels();
  }, []);

  const isMultiKey = isMultiKeyChannel(
    Number(form.type),
    form.key || '',
    form.channel_info,
  );
  const t = Number(form.type);
  const isOpenAI = t === 1 || t === 6;
  const isAzure = t === 3;
  const isClaude = t === 14;
  const isVertex = t === 41;
  const isAWS = t === 33;
  const isOpenRouter = t === 20;
  const otherField = CHANNEL_OTHER_FIELDS[t];

  return (
    <SlideOver
      open
      title={
        <span className='text-lg font-semibold'>
          {isEdit
            ? translate('Edit channel #{{id}}', { id: channel.id })
            : translate('新建渠道')}
        </span>
      }
      onClose={onClose}
      width={560}
      footer={
        <>
          <Button variant='toggle' onClick={onClose}>
            {translate('取消')}
          </Button>
          <Button
            loading={saving}
            disabled={fetchingModels || !mappingValid}
            onClick={save}
          >
            {isEdit ? translate('保存') : translate('创建')}
          </Button>
        </>
      }
    >
      <fieldset
        disabled={saving || fetchingModels}
        className='min-w-0 px-6 pb-6 space-y-6'
      >
        {(groups.isError || defaults.isError || plugins.isError) && (
          <div role='alert' className='text-sm text-ui-danger'>
            {translate('Some channel options could not be loaded')}{' '}
            <Button
              size='sm'
              onClick={() => {
                void groups.refetch();
                void defaults.refetch();
                if (canBindPlugin) void plugins.refetch();
              }}
            >
              {translate('Retry')}
            </Button>
          </div>
        )}
        {/* 基本信息 */}
        <Section title={translate('基本信息')}>
          <div className='space-y-4'>
            <Field label={translate('类型')}>
              <Select
                popover
                value={form.type}
                onChange={changeType}
                options={TYPE_OPTIONS.filter(
                  (option) =>
                    option.value !== 61 ||
                    canBindPlugin ||
                    Number(channel.type) === 61,
                )}
                width='full'
              />
            </Field>
            <Field label={translate('名称')}>
              <Input
                value={form.name || ''}
                onChange={u('name')}
                width='full'
                placeholder={translate('请为渠道命名')}
              />
            </Field>
          </div>
          {!isEdit && t !== 57 && (
            <Field label={translate('创建模式')}>
              <Select
                popover
                value={mode}
                onChange={setMode}
                width='full'
                options={[
                  { value: 'single', label: translate('单个创建') },
                  {
                    value: 'batch',
                    label: translate('批量创建（每行一个 key 创建一个渠道）'),
                  },
                  {
                    value: 'multi_to_single',
                    label: translate('多 Key 合一（多个 key 归入同一渠道）'),
                  },
                ]}
              />
            </Field>
          )}
        </Section>

        {[60, 61].includes(Number(form.type)) &&
          (canBindPlugin || Number(channel.type) === 61) && (
            <Section title={translate('任务插件')}>
              {pluginOptionsError && (
                <p role='alert' className='text-sm text-ui-danger'>
                  {pluginOptionsError}
                </p>
              )}
              {Number(form.type) === 61 ? (
                <Field
                  label={translate('绑定插件')}
                  hint={translate(
                    '专用渠道使用此插件处理提交、查询和结果转换。',
                  )}
                >
                  <Select
                    popover
                    value={form.setting?.task_plugin_key || ''}
                    onChange={selectPlugin}
                    width='full'
                    options={[
                      { value: '', label: translate('选择插件') },
                      ...taskPlugins.map((plugin) => ({
                        value: plugin.key,
                        label: plugin.name
                          ? `${plugin.name} · ${plugin.key}`
                          : plugin.key,
                      })),
                      ...(form.setting?.task_plugin_key &&
                      !taskPlugins.some(
                        (plugin) => plugin.key === form.setting.task_plugin_key,
                      )
                        ? [
                            {
                              value: form.setting.task_plugin_key,
                              label: translate('{{key}} (not loaded)', {
                                key: form.setting.task_plugin_key,
                              }),
                            },
                          ]
                        : []),
                    ]}
                  />
                </Field>
              ) : (
                <Field
                  label={translate('扩展插件')}
                  hint={translate(
                    '仅列出支持 New API 上游的插件；可同时绑定多个。',
                  )}
                >
                  <MultiSelect
                    popover
                    value={form.setting?.task_extend_plugin_keys || []}
                    onChange={uSetting('task_extend_plugin_keys')}
                    options={taskPlugins
                      .filter((plugin) => plugin.upstreams?.includes('new_api'))
                      .map((plugin) => ({
                        value: plugin.key,
                        label: plugin.name
                          ? `${plugin.name} · ${plugin.key}`
                          : plugin.key,
                      }))}
                  />
                </Field>
              )}
              {Number(form.type) === 61 && (
                <p className='text-xs text-ui-text-3'>
                  {translate(
                    '首次选择插件会补充空白的 API 地址和模型列表。已填写的地址由渠道配置保留。',
                  )}
                </p>
              )}
            </Section>
          )}

        {/* 密钥与连接 */}
        <Section title={translate('密钥与连接')}>
          {[1, 58, 59, 60].includes(Number(form.type)) && (
            <Field
              compact
              label='Responses WebSocket'
              hint={translate(
                '允许 /v1/responses 的持久连接；高级自定义渠道需配置原生 Responses 路由。',
              )}
            >
              <Switch
                size='sm'
                checked={!!form.setting?.responses_websocket_enabled}
                onChange={uSetting('responses_websocket_enabled')}
              />
            </Field>
          )}
          <Field wide
            label={
              <>
                {translate('密钥')}
                {isEdit && (
                  <span className='text-ui-text-3 text-xs'>
                    {translate('(留空不修改)')}
                  </span>
                )}
              </>
            }
            hint={
              t === 57
                ? translate(
                    'Paste the complete Codex OAuth JSON credential. Only single creation is supported.',
                  )
                : CHANNEL_KEY_HINTS[t] ||
                  (mode === 'batch'
                    ? translate('每行一个 key，将创建多个渠道')
                    : mode === 'multi_to_single'
                      ? translate('每行一个 key，合并为一个渠道')
                      : translate('请输入渠道对应的鉴权密钥'))
            }
          >
            <Textarea
              value={form.key || ''}
              onChange={u('key')}
              rows={t === 57 ? 7 : mode !== 'single' || isMultiKey ? 5 : 2}
              placeholder={CHANNEL_KEY_HINTS[t] || 'sk-...'}
              width='full'
            />
          </Field>
          {!isEdit && mode === 'batch' && (
            <Field compact label={translate('将 key 前缀追加到渠道名称')}>
              <Switch
                size='sm'
                checked={batchPrefix}
                onChange={setBatchPrefix}
              />
            </Field>
          )}
          {t !== 57 &&
            (mode === 'multi_to_single' || (isEdit && isMultiKey)) && (
              <Field label={translate('多 Key 模式')}>
                <Select
                  popover
                  value={form.multi_key_mode || 'random'}
                  onChange={u('multi_key_mode')}
                  options={MULTI_KEY_MODE_OPTIONS.map((option) => ({
                    ...option,
                    label: translate(option.label),
                  }))}
                  width='full'
                />
              </Field>
            )}
          {isOpenAI && (
            <Field
              label={translate('组织')}
              hint={translate('不填则为默认组织')}
            >
              <Input
                value={form.openai_organization || ''}
                onChange={u('openai_organization')}
                width='full'
                placeholder='org-xxx'
              />
            </Field>
          )}
          <Field
            label={translate('API 地址')}
            hint={translate('末尾不要带 /v1 和 /，留空使用默认')}
          >
            <Input
              value={form.base_url || ''}
              onChange={u('base_url')}
              placeholder={
                defaultBaseURLs[form.type] || 'https://api.example.com'
              }
              width='full'
            />
          </Field>
          {otherField && (
            <Field label={translate(otherField.label)}>
              <Input
                value={form.other || ''}
                onChange={u('other')}
                width='full'
                placeholder={otherField.placeholder}
              />
            </Field>
          )}
          {isAWS && (
            <Field
              label={translate('AWS 接口')}
              hint={translate(
                'Mantle 使用原生 Messages；凭据格式为 APIKey|Region 或 AccessKey|SecretAccessKey|Region。',
              )}
            >
              <Select
                popover
                value={form.other_settings?.aws_api_type || 'invoke_model'}
                onChange={uOther('aws_api_type')}
                width='full'
                options={[
                  {
                    value: 'invoke_model',
                    label: translate('InvokeModel（默认）'),
                  },
                  { value: 'mantle', label: 'Mantle Messages' },
                ]}
              />
            </Field>
          )}
          {isAWS && (
            <Field label={translate('AWS Key 类型')}>
              <Select
                popover
                value={form.other_settings?.aws_key_type || 'ak_sk'}
                onChange={uOther('aws_key_type')}
                width='full'
                options={[
                  { value: 'ak_sk', label: 'AK/SK' },
                  { value: 'api_key', label: 'API Key' },
                ]}
              />
            </Field>
          )}
          {isVertex && (
            <Field label={translate('Vertex Key 类型')}>
              <Select
                popover
                value={form.other_settings?.vertex_key_type || 'json'}
                onChange={uOther('vertex_key_type')}
                width='full'
                options={[
                  { value: 'json', label: translate('JSON 凭证') },
                  { value: 'api_key', label: 'API Key' },
                ]}
              />
            </Field>
          )}
          {isVertex && form.other_settings?.vertex_key_type === 'api_key' && (
            <Field
              label='Vertex Project ID'
              hint={translate(
                '可选。普通 Vertex API Key 填写所属项目；Express 模式可留空。',
              )}
            >
              <Input
                value={form.other_settings?.vertex_project_id || ''}
                onChange={uOther('vertex_project_id')}
                width='full'
              />
            </Field>
          )}
        </Section>

        {/* 模型配置 */}
        <Section title={translate('模型配置')}>
          <Field wide label={translate('支持模型')}>
            <div className='min-w-0 space-y-2'>
              <div className='flex flex-wrap items-center justify-end gap-x-3 gap-y-2'>
                {isEdit && (
                  <button
                    onClick={fetchModels}
                    disabled={fetchingModels}
                    className='text-xs text-ui-text-2 hover:text-ui-text cursor-pointer underline'
                  >
                    {fetchingModels
                      ? translate('获取中…')
                      : translate('获取模型列表')}
                  </button>
                )}
                {!isEdit && MODEL_FETCHABLE_CHANNEL_TYPES.has(form.type) && (
                  <button
                    onClick={fetchModelsFromUrl}
                    disabled={fetchingModels}
                    className='text-xs text-ui-text-2 hover:text-ui-text cursor-pointer underline'
                  >
                    {fetchingModels
                      ? translate('获取中…')
                      : translate('从上游拉取')}
                  </button>
                )}
                <button
                  onClick={fillDefaultModels}
                  className='text-xs text-ui-text-2 hover:text-ui-text cursor-pointer underline'
                >
                  {translate('填入默认模型')}
                </button>
                <button
                  onClick={clearModels}
                  className='text-xs text-ui-text-2 hover:text-ui-text cursor-pointer underline'
                >
                  {translate('清除所有')}
                </button>
              </div>
              <ModelTagList
                models={form.models || ''}
                onChange={(v) => setForm((p) => ({ ...p, models: v }))}
              />
            </div>
          </Field>
          <Field wide label={translate('自定义模型名称')}>
            <div className='flex items-center gap-2'>
              <div className='min-w-0 flex-1'>
                <Input
                  value={customModel}
                  onChange={setCustomModel}
                  width='full'
                  placeholder={translate('输入自定义模型名称')}
                  onKeyDown={(e) => e.key === 'Enter' && addCustomModel()}
                />
              </div>
              <Button
                variant='toggle'
                onClick={addCustomModel}
                style={{ flexShrink: 0 }}
              >
                {translate('填入')}
              </Button>
            </div>
          </Field>
          <Field label={translate('分组')}>
            <MultiSelect
              popover
              options={groupOptions}
              value={
                form.group
                  ? form.group
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                  : []
              }
              onChange={(arr) =>
                setForm((p) => ({ ...p, group: arr.join(',') }))
              }
              placeholder={translate('选择分组')}
              width='full'
            />
          </Field>
          <Field wide label={translate('模型重定向')}>
            <ModelMappingEditor
              value={form.model_mapping || ''}
              models={form.models || ''}
              upstreamModels={upstreamModels}
              onChange={u('model_mapping')}
              onModelsChange={u('models')}
              onValidityChange={setMappingValid}
              onFetchUpstream={loadUpstreamModels}
            />
          </Field>
          <Field
            label={translate('是否自动禁用')}
            hint={translate('仅当系统设置中自动禁用开启时有效')}
          >
            <Select
              popover
              value={form.auto_ban ?? 1}
              onChange={(v) => u('auto_ban')(v)}
              width='full'
              options={[
                { value: 1, label: translate('是（异常时自动禁用）') },
                { value: 0, label: translate('否（不自动禁用）') },
              ]}
            />
          </Field>
        </Section>

        {/* 高级设置 */}
        <Section title={translate('高级设置')} collapsible>
          <TransportSettings
            value={form.setting || {}}
            onChange={(value) =>
              setForm((previous) => ({ ...previous, setting: value }))
            }
            disabled={saving}
          />
          {Number(form.type) === 58 && (
            <Field wide
              label={translate('协议路由')}
              hint={translate(
                '配置 advanced_routes：入口路径、上游路径、转换器、模型范围和认证。模型获取需要 /v1/models 路由。',
              )}
            >
              <Textarea
                value={advancedRoutesJSON}
                onChange={setAdvancedRoutesJSON}
                rows={10}
                width='full'
                placeholder={
                  '{"advanced_routes":[{"incoming_path":"/v1/chat/completions","upstream_path":"/v1/chat/completions","converter":"none"},{"incoming_path":"/v1/models","upstream_path":"/v1/models","converter":"none"}]}'
                }
              />
            </Field>
          )}
          <Field
            label={translate('协议转换策略')}
            hint={translate('控制工具或内容无法完整转换时的处理方式。')}
          >
            <Select
              popover
              value={form.other_settings?.tool_loss_policy || 'allow'}
              onChange={uOther('tool_loss_policy')}
              width='full'
              options={[
                {
                  value: 'allow',
                  label: translate('兼容：允许转换并记录损失'),
                },
                {
                  value: 'safe',
                  label: translate('安全：拒绝影响工具语义的转换'),
                },
                { value: 'strict', label: translate('严格：拒绝所有有损转换') },
              ]}
            />
          </Field>
          {/* 上游模型管理 */}
          <div className='space-y-3 pb-3 border-b border-[#eeeeee]'>
            <span className='text-xs font-medium text-ui-text-2'>
              {translate('上游模型管理')}
            </span>
            <Field compact label={translate('检测上游模型更新')}>
              <Switch
                size='sm'
                checked={
                  !!form.other_settings?.upstream_model_update_check_enabled
                }
                onChange={(v) =>
                  uOther('upstream_model_update_check_enabled')(v)
                }
              />
            </Field>
            <p className='text-xs text-ui-text-3'>
              {translate('开启后由后端定时任务检测该渠道上游模型变化')}
            </p>
            <Field compact label={translate('自动同步上游模型更新')}>
              <Switch
                size='sm'
                checked={
                  !!form.other_settings?.upstream_model_update_auto_sync_enabled
                }
                onChange={(v) =>
                  uOther('upstream_model_update_auto_sync_enabled')(v)
                }
              />
            </Field>
            <p className='text-xs text-ui-text-3'>
              {translate('开启后检测到新增模型会自动加入当前渠道模型列表')}
            </p>
            <Field
              label={translate('已忽略模型')}
              hint={translate('支持 regex: 前缀正则匹配')}
            >
              <Input
                value={(
                  form.other_settings?.upstream_model_update_ignored_models ||
                  []
                ).join(',')}
                onChange={(v) =>
                  uOther('upstream_model_update_ignored_models')(
                    v ? v.split(',').map((s) => s.trim()) : [],
                  )
                }
                width='full'
                placeholder='gpt-4.1-nano,regex:^sora-.*$'
              />
            </Field>
          </div>

          {/* 请求配置 */}
          <div className='space-y-4 pb-3 border-b border-[#eeeeee]'>
            <span className='text-xs font-medium text-ui-text-2'>
              {translate('请求配置')}
            </span>
            <Field wide label={translate('参数覆盖')}>
              <KeyValueEditor
                jsonValues
                value={form.param_override || ''}
                onChange={u('param_override')}
                keyPlaceholder={translate('参数名')}
                valuePlaceholder={translate('参数值')}
                hint={translate('用于覆盖请求参数，不支持覆盖 stream 参数')}
              />
            </Field>
            <Field wide label={translate('请求头覆盖')}>
              <KeyValueEditor
                value={form.header_override || ''}
                onChange={u('header_override')}
                keyPlaceholder={translate('Header 名')}
                valuePlaceholder={translate('Header 值')}
                hint={translate('支持变量：渠道密钥 {api_key}')}
              />
            </Field>
            <Field wide label={translate('状态码复写')}>
              <KeyValueEditor
                value={form.status_code_mapping || ''}
                onChange={u('status_code_mapping')}
                keyPlaceholder={translate('原状态码')}
                valuePlaceholder={translate('复写状态码')}
                hint={translate(
                  '键为原状态码，值为要复写的状态码，仅影响本地判断',
                )}
              />
            </Field>
          </div>

          {/* 渠道行为 */}
          <div className='space-y-4 pb-3 border-b border-[#eeeeee]'>
            <span className='text-xs font-medium text-ui-text-2'>
              {translate('渠道行为')}
            </span>
            <div className='space-y-4'>
              <Field label={translate('渠道标签')}>
                <Input
                  value={form.tag || ''}
                  onChange={u('tag')}
                  width='full'
                  placeholder={translate('可选')}
                />
              </Field>
              <Field label={translate('测试模型')}>
                <Select
                  popover
                  value={form.test_model || ''}
                  onChange={u('test_model')}
                  width='full'
                  options={[
                    { value: '', label: translate('Use first model') },
                    ...testModels.map((model) => ({ value: model, label: model })),
                  ]}
                />
              </Field>
            </div>
            <Field wide label={translate('备注')} hint={translate('仅管理员可见')}>
              <Textarea
                value={form.remark || ''}
                onChange={u('remark')}
                rows={2}
                placeholder={translate('请输入备注')}
                width='full'
              />
            </Field>
            <div className='space-y-4'>
              <Field label={translate('优先级')}>
                <NumberInput
                  value={form.priority ?? 0}
                  onChange={(v) => u('priority')(v)}
                  width='full'
                />
              </Field>
              <Field label={translate('权重')}>
                <NumberInput
                  value={form.weight ?? 0}
                  onChange={(v) => u('weight')(v)}
                  width='full'
                />
              </Field>
              <Field label={translate('状态')}>
                <Select
                  popover
                  value={form.status || 1}
                  disabled={isEdit}
                  onChange={(v) => u('status')(v as 1 | 2)}
                  width='full'
                  options={[
                    { value: 1, label: translate('启用') },
                    { value: 2, label: translate('禁用') },
                  ]}
                />
              </Field>
            </div>
          </div>

          {Number(form.type) === 4 && (
            <div className='space-y-3 pb-3 border-b border-[#eeeeee]'>
              <span className='text-xs font-medium text-ui-text-2'>Ollama</span>
              <Field compact label={translate('使用 OpenAI 兼容聊天接口')} hint={translate('启用后通过 /v1/chat/completions 转发聊天请求')}>
                <Switch
                  size='sm'
                  checked={!!form.other_settings?.ollama_openai_chat}
                  onChange={(v) => uOther('ollama_openai_chat')(v)}
                />
              </Field>
            </div>
          )}

          {/* 字段透传控制 */}
          <div className='space-y-3 pb-3 border-b border-[#eeeeee]'>
            <span className='text-xs font-medium text-ui-text-2'>
              {translate('字段透传控制')}
            </span>
            <Field compact label={translate('允许 service_tier 透传')} hint={translate('允许透传可能导致实际计费高于预期')}>
              <Switch
                size='sm'
                checked={!!form.other_settings?.allow_service_tier}
                onChange={(v) => uOther('allow_service_tier')(v)}
              />
            </Field>
            <Field compact label={translate('禁用 store 透传')} hint={translate('开启后可能导致 Codex 无法正常使用')}>
              <Switch
                size='sm'
                checked={!!form.other_settings?.disable_store}
                onChange={(v) => uOther('disable_store')(v)}
              />
            </Field>
            <Field compact label={translate('允许 safety_identifier 透传')} hint={translate('默认关闭以保护用户隐私')}>
              <Switch
                size='sm'
                checked={!!form.other_settings?.allow_safety_identifier}
                onChange={(v) => uOther('allow_safety_identifier')(v)}
              />
            </Field>
            <Field compact label={translate('允许 stream_options.include_obfuscation 透传')} hint={translate('默认关闭以避免客户端关闭安全保护')}>
              <Switch
                size='sm'
                checked={!!form.other_settings?.allow_include_obfuscation}
                onChange={(v) => uOther('allow_include_obfuscation')(v)}
              />
            </Field>
            {isClaude && (
              <>
                <Field compact label='Claude Beta Query (?beta=true)'>
                  <Switch
                    size='sm'
                    checked={!!form.other_settings?.claude_beta_query}
                    onChange={(v) => uOther('claude_beta_query')(v)}
                  />
                </Field>
                <Field compact label={translate('允许 inference_geo 透传')}>
                  <Switch
                    size='sm'
                    checked={!!form.other_settings?.allow_inference_geo}
                    onChange={(v) => uOther('allow_inference_geo')(v)}
                  />
                </Field>
                <Field compact label={translate('允许 speed 参数透传')}>
                  <Switch
                    size='sm'
                    checked={!!form.other_settings?.allow_speed}
                    onChange={(v) => uOther('allow_speed')(v)}
                  />
                </Field>
              </>
            )}
            {isOpenRouter && (
              <Field compact label={translate('OpenRouter Enterprise 模式')}>
                <Switch
                  size='sm'
                  checked={!!form.other_settings?.openrouter_enterprise}
                  onChange={(v) => uOther('openrouter_enterprise')(v)}
                />
              </Field>
            )}
            {isAzure && (
              <Field label='Azure Responses API Version'>
                <Input
                  value={form.other_settings?.azure_responses_version || ''}
                  onChange={uOther('azure_responses_version')}
                  width='full'
                  placeholder='2024-02-01'
                />
              </Field>
            )}
          </div>

          {/* 额外设置 */}
          <div className='space-y-4'>
            <span className='text-xs font-medium text-ui-text-2'>
              {translate('额外设置')}
            </span>
            <Field compact label={translate('强制格式化')} hint={translate('强制将响应格式化为 OpenAI 标准格式')}>
              <Switch
                size='sm'
                checked={!!form.setting?.force_format}
                onChange={(v) => uSetting('force_format')(v)}
              />
            </Field>
            <Field
              compact
              label={translate('思考内容转换')}
              hint={translate('将 reasoning_content 转换为 &lt;think&gt; 标签拼接到内容中')}
            >
              <Switch
                size='sm'
                checked={!!form.setting?.thinking_to_content}
                onChange={(v) => uSetting('thinking_to_content')(v)}
              />
            </Field>
            <Field compact label={translate('透传请求体')} hint={translate('启用请求体透传功能')}>
              <Switch
                size='sm'
                checked={!!form.setting?.pass_through_body_enabled}
                onChange={(v) => uSetting('pass_through_body_enabled')(v)}
              />
            </Field>
            <Field
              label={translate('代理地址')}
              hint={translate('支持 socks5 协议')}
            >
              <Input
                value={form.setting?.proxy || ''}
                onChange={uSetting('proxy')}
                width='full'
                placeholder='socks5://user:pass@host:port'
              />
            </Field>
            <Field wide label={translate('系统提示词')}>
              <Textarea
                value={form.setting?.system_prompt || ''}
                onChange={uSetting('system_prompt')}
                rows={3}
                placeholder={translate('输入系统提示词')}
                width='full'
              />
            </Field>
            <Field
              compact
              label={translate('系统提示词覆盖')}
              hint={translate('用户优先：如果用户请求中指定了系统提示词，将优先使用用户的设置。关闭则拼接到用户提示词前面')}
            >
              <Switch
                size='sm'
                checked={!!form.setting?.system_prompt_override}
                onChange={(v) => uSetting('system_prompt_override')(v)}
              />
            </Field>
          </div>
        </Section>
      </fieldset>
    </SlideOver>
  );
}

export default function ChannelEditModal(props: {
  channel: EditingChannel;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  let error = '';
  try {
    createChannelDraft(props.channel);
  } catch (cause) {
    error = apiErrorMessage(cause, 'Invalid channel configuration');
  }
  if (error)
    return (
      <SlideOver
        open
        title={t('Invalid channel configuration')}
        onClose={props.onClose}
      >
        <p role='alert' className='p-6 text-sm text-ui-danger'>
          {t(error)}
        </p>
      </SlideOver>
    );
  return <ChannelEditForm {...props} />;
}

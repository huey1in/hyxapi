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

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  API,
  showError,
  showInfo,
  showSuccess,
  verifyJSON,
} from '../../../../helpers';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import { CHANNEL_OPTIONS, MODEL_FETCHABLE_CHANNEL_TYPES } from '../../../../constants';
import SlideOver from '../../../common/SlideOver';
import { showConfirm } from '../../../common/ConfirmDialog';
import {
  TextField,
  NumberField,
  TextAreaField,
  Toggle,
  ToggleField,
  NativeSelect,
  Notice,
  Section,
  Chip,
  TagInput,
  MultiCombobox,
  Combobox,
  HighlightText,
  FieldRow,
  createFormApiAdapter,
} from '../../../common/form/Primitives';
import { Zap, AlertTriangle, Loader2 } from 'lucide-react';
import {
  getChannelModels,
  copy,
  getChannelIcon,
  getModelCategories,
  selectFilter,
} from '../../../../helpers';
import ModelSelectModal from './ModelSelectModal';
import SingleModelSelectModal from './SingleModelSelectModal';
import CodexOAuthModal from './CodexOAuthModal';
import ParamOverrideEditorModal from './ParamOverrideEditorModal';
import JSONEditor from '../../../common/ui/JSONEditor';
import SecureVerificationModal from '../../../common/modals/SecureVerificationModal';
import StatusCodeRiskGuardModal from './StatusCodeRiskGuardModal';
import { Button, Tabs as UITabs, IconButton } from '../../../ui';
import { X as XIcon } from 'lucide-react';
import ChannelKeyDisplay from '../../../common/ui/ChannelKeyDisplay';
import { useSecureVerification } from '../../../../hooks/common/useSecureVerification';
import { parseChannelConnectionString } from '../../../../helpers/token';
import { createApiCalls } from '../../../../services/secureVerification';
import {
  collectInvalidStatusCodeEntries,
  collectNewDisallowedStatusCodeRedirects,
} from './statusCodeRiskGuard';

// Removed Semi UI Typography aliases — token primitives are used everywhere instead.

const MODEL_MAPPING_EXAMPLE = {
  'gpt-3.5-turbo': 'gpt-3.5-turbo-0125',
};

const STATUS_CODE_MAPPING_EXAMPLE = {
  400: '500',
};

const REGION_EXAMPLE = {
  default: 'global',
  'gemini-1.5-pro-002': 'europe-west2',
  'gemini-1.5-flash-002': 'europe-west2',
  'claude-3-5-sonnet-20240620': 'europe-west1',
};
const UPSTREAM_DETECTED_MODEL_PREVIEW_LIMIT = 8;
const ADVANCED_SETTINGS_EXPANDED_KEY = 'channel-advanced-settings-expanded';

const PARAM_OVERRIDE_LEGACY_TEMPLATE = {
  temperature: 0,
};

const PARAM_OVERRIDE_OPERATIONS_TEMPLATE = {
  operations: [
    {
      path: 'temperature',
      mode: 'set',
      value: 0.7,
      conditions: [
        {
          path: 'model',
          mode: 'prefix',
          value: 'openai/',
        },
      ],
      logic: 'AND',
    },
  ],
};

const DEPRECATED_DOUBAO_CODING_PLAN_BASE_URL = 'doubao-coding-plan';

// 支持并且已适配通过接口获取模型列表的渠道类型
const MODEL_FETCHABLE_TYPES = new Set([
  1, 4, 14, 34, 17, 26, 27, 24, 47, 25, 20, 23, 31, 40, 42, 48, 43,
]);

function type2secretPrompt(type) {
  // inputs.type === 15 ? '按照如下格式输入：APIKey|SecretKey' : (inputs.type === 18 ? '按照如下格式输入：APPID|APISecret|APIKey' : '请输入渠道对应的鉴权密钥')
  switch (type) {
    case 15:
      return '按照如下格式输入：APIKey|SecretKey';
    case 18:
      return '按照如下格式输入：APPID|APISecret|APIKey';
    case 22:
      return '按照如下格式输入：APIKey-AppId，例如：fastgpt-0sp2gtvfdgyi4k30jwlgwf1i-64f335d84283f05518e9e041';
    case 23:
      return '按照如下格式输入：AppId|SecretId|SecretKey';
    case 33:
      return '按照如下格式输入：Ak|Sk|Region';
    case 45:
      return '请输入渠道对应的鉴权密钥, 豆包语音输入：AppId|AccessToken';
    case 50:
      return '按照如下格式输入: AccessKey|SecretKey, 如果上游是New API，则直接输ApiKey';
    case 51:
      return '按照如下格式输入: AccessKey|SecretAccessKey';
    case 57:
      return '请输入 JSON 格式的 OAuth 凭据（必须包含 access_token 和 account_id）';
    default:
      return '请输入渠道对应的鉴权密钥';
  }
}

const EditChannelModal = (props) => {
  const { t } = useTranslation();
  const channelId = props.editingChannel.id;
  const isEdit = channelId !== undefined;
  const [loading, setLoading] = useState(isEdit);
  const isMobile = useIsMobile();
  const handleCancel = () => {
    props.handleClose();
  };
  const originInputs = {
    name: '',
    type: 1,
    key: '',
    openai_organization: '',
    max_input_tokens: 0,
    base_url: '',
    other: '',
    model_mapping: '',
    param_override: '',
    status_code_mapping: '',
    models: [],
    auto_ban: 1,
    test_model: '',
    groups: ['default'],
    priority: 0,
    weight: 0,
    tag: '',
    multi_key_mode: 'random',
    // 渠道额外设置的默认值
    force_format: false,
    thinking_to_content: false,
    proxy: '',
    pass_through_body_enabled: false,
    system_prompt: '',
    system_prompt_override: false,
    settings: '',
    // 仅 Vertex: 密钥格式（存入 settings.vertex_key_type）
    vertex_key_type: 'json',
    // 仅 AWS: 密钥格式和区域（存入 settings.aws_key_type 和 settings.aws_region）
    aws_key_type: 'ak_sk',
    // 企业账户设置
    is_enterprise_account: false,
    // 字段透传控制默认值
    allow_service_tier: false,
    disable_store: false, // false = 允许透传（默认开启）
    allow_safety_identifier: false,
    allow_include_obfuscation: false,
    allow_inference_geo: false,
    allow_speed: false,
    claude_beta_query: false,
    upstream_model_update_check_enabled: false,
    upstream_model_update_auto_sync_enabled: false,
    upstream_model_update_last_check_time: 0,
    upstream_model_update_last_detected_models: [],
    upstream_model_update_ignored_models: '',
  };
  const [batch, setBatch] = useState(false);
  const [multiToSingle, setMultiToSingle] = useState(false);
  const [multiKeyMode, setMultiKeyMode] = useState('random');
  const [autoBan, setAutoBan] = useState(true);
  const [inputs, setInputs] = useState(originInputs);
  const [originModelOptions, setOriginModelOptions] = useState([]);
  const [modelOptions, setModelOptions] = useState([]);
  const [groupOptions, setGroupOptions] = useState([]);
  const [basicModels, setBasicModels] = useState([]);
  const [fullModels, setFullModels] = useState([]);
  const [modelGroups, setModelGroups] = useState([]);
  const [customModel, setCustomModel] = useState('');
  const [modelSearchValue, setModelSearchValue] = useState('');
  const [modalImageUrl, setModalImageUrl] = useState('');
  const [isModalOpenurl, setIsModalOpenurl] = useState(false);
  const [modelModalVisible, setModelModalVisible] = useState(false);
  const [fetchedModels, setFetchedModels] = useState([]);
  const [modelMappingValueModalVisible, setModelMappingValueModalVisible] =
    useState(false);
  const [modelMappingValueModalModels, setModelMappingValueModalModels] =
    useState([]);
  const [modelMappingValueKey, setModelMappingValueKey] = useState('');
  const [modelMappingValueSelected, setModelMappingValueSelected] =
    useState('');
  const formApiRef = useRef(null);
  // Adapter — dispatches sub-modal setValue/setValues calls into our `inputs` state.
  // Bound to formApiRef so existing JSONEditor / ModelSelectModal / SingleModelSelectModal /
  // OllamaModelModal / ParamOverrideEditorModal callbacks (which read/write through formApi)
  // keep working unchanged after we drop Semi `<Form>`.
  const inputsLatestRef = useRef(inputs);
  inputsLatestRef.current = inputs;
  const formApiAdapter = useMemo(
    () => ({
      getValue: (field) => inputsLatestRef.current?.[field],
      getValues: () => inputsLatestRef.current,
      setValue: (field, value) =>
        setInputs((prev) => ({ ...prev, [field]: value })),
      setValues: (values) =>
        setInputs((prev) => ({ ...prev, ...(values || {}) })),
      reset: () => {},
      submitForm: () => submit(),
    }),
    [],
  );
  // Bind once on mount; `<Form getFormApi>` may overwrite while still mounted but
  // gets restored every render via the effect below.
  useEffect(() => {
    formApiRef.current = formApiAdapter;
  }, [formApiAdapter]);
  const [vertexKeys, setVertexKeys] = useState([]);
  const [vertexFileList, setVertexFileList] = useState([]);
  const vertexErroredNames = useRef(new Set()); // 避免重复报错
  const [isMultiKeyChannel, setIsMultiKeyChannel] = useState(false);
  const [channelSearchValue, setChannelSearchValue] = useState('');
  const [useManualInput, setUseManualInput] = useState(false); // 是否使用手动输入模式
  const [keyMode, setKeyMode] = useState('append'); // 密钥模式：replace（覆盖）或 append（追加）
  const [isEnterpriseAccount, setIsEnterpriseAccount] = useState(false); // 是否为企业账户
  const [doubaoApiEditUnlocked, setDoubaoApiEditUnlocked] = useState(false); // 豆包渠道自定义 API 地址隐藏入口
  const redirectModelList = useMemo(() => {
    const mapping = inputs.model_mapping;
    if (typeof mapping !== 'string') return [];
    const trimmed = mapping.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return [];
      }
      const values = Object.values(parsed)
        .map((value) => (typeof value === 'string' ? value.trim() : undefined))
        .filter((value) => value);
      return Array.from(new Set(values));
    } catch (error) {
      return [];
    }
  }, [inputs.model_mapping]);
  const upstreamDetectedModels = useMemo(
    () =>
      Array.from(
        new Set(
          (inputs.upstream_model_update_last_detected_models || [])
            .map((model) => String(model || '').trim())
            .filter(Boolean),
        ),
      ),
    [inputs.upstream_model_update_last_detected_models],
  );
  const upstreamDetectedModelsPreview = useMemo(
    () => upstreamDetectedModels.slice(0, UPSTREAM_DETECTED_MODEL_PREVIEW_LIMIT),
    [upstreamDetectedModels],
  );
  const upstreamDetectedModelsOmittedCount =
    upstreamDetectedModels.length - upstreamDetectedModelsPreview.length;
  const modelSearchMatchedCount = useMemo(() => {
    const keyword = modelSearchValue.trim();
    if (!keyword) {
      return modelOptions.length;
    }
    return modelOptions.reduce(
      (count, option) => count + (selectFilter(keyword, option) ? 1 : 0),
      0,
    );
  }, [modelOptions, modelSearchValue]);
  const modelSearchHintText = useMemo(() => {
    const keyword = modelSearchValue.trim();
    if (!keyword || modelSearchMatchedCount !== 0) {
      return '';
    }
    return t('未匹配到模型，按回车键可将「{{name}}」作为自定义模型名添加', {
      name: keyword,
    });
  }, [modelSearchMatchedCount, modelSearchValue, t]);
  const paramOverrideMeta = useMemo(() => {
    const raw =
      typeof inputs.param_override === 'string'
        ? inputs.param_override.trim()
        : '';
    if (!raw) {
      return {
        tagLabel: t('不更改'),
        tagColor: 'grey',
        preview: t(
          '此项可选，用于覆盖请求参数。不支持覆盖 stream 参数',
        ),
      };
    }
    if (!verifyJSON(raw)) {
      return {
        tagLabel: t('JSON格式错误'),
        tagColor: 'red',
        preview: raw,
      };
    }
    try {
      const parsed = JSON.parse(raw);
      const pretty = JSON.stringify(parsed, null, 2);
      if (
        parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed) &&
        Array.isArray(parsed.operations)
      ) {
        return {
          tagLabel: `${t('新格式模板')} (${parsed.operations.length})`,
          tagColor: 'cyan',
          preview: pretty,
        };
      }
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return {
          tagLabel: `${t('旧格式模板')} (${Object.keys(parsed).length})`,
          tagColor: 'blue',
          preview: pretty,
        };
      }
      return {
        tagLabel: t('自定义 JSON'),
        tagColor: 'orange',
        preview: pretty,
      };
    } catch (error) {
      return {
        tagLabel: t('JSON格式错误'),
        tagColor: 'red',
        preview: raw,
      };
    }
  }, [inputs.param_override, t]);
  const [isIonetChannel, setIsIonetChannel] = useState(false);
  const [ionetMetadata, setIonetMetadata] = useState(null);
  const [codexOAuthModalVisible, setCodexOAuthModalVisible] = useState(false);
  const [codexCredentialRefreshing, setCodexCredentialRefreshing] =
    useState(false);
  const [paramOverrideEditorVisible, setParamOverrideEditorVisible] =
    useState(false);

  // 密钥显示状态
  const [keyDisplayState, setKeyDisplayState] = useState({
    showModal: false,
    keyData: '',
  });

  // 专门的2FA验证状态（用于TwoFactorAuthModal）
  const [show2FAVerifyModal, setShow2FAVerifyModal] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');

  useEffect(() => {
    if (!isEdit) {
      setIsIonetChannel(false);
      setIonetMetadata(null);
    }
  }, [isEdit]);

  const handleOpenIonetDeployment = () => {
    if (!ionetMetadata?.deployment_id) {
      return;
    }
    const targetUrl = `/console/deployment?deployment_id=${ionetMetadata.deployment_id}`;
    window.open(targetUrl, '_blank', 'noopener');
  };
  const [verifyLoading, setVerifyLoading] = useState(false);
  const statusCodeRiskConfirmResolverRef = useRef(null);
  const [statusCodeRiskConfirmVisible, setStatusCodeRiskConfirmVisible] =
    useState(false);
  const [statusCodeRiskDetailItems, setStatusCodeRiskDetailItems] = useState(
    [],
  );

  // 剪贴板连接信息自动检测
  const [clipboardConfig, setClipboardConfig] = useState(null);

  // 高级设置折叠状态
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);
  const toggleAdvancedSettings = (open) => {
    setAdvancedSettingsOpen(open);
    localStorage.setItem(ADVANCED_SETTINGS_EXPANDED_KEY, String(open));
  };
  const formContainerRef = useRef(null);
  const doubaoApiClickCountRef = useRef(0);
  const initialBaseUrlRef = useRef('');
  const initialModelsRef = useRef([]);
  const initialModelMappingRef = useRef('');
  const initialStatusCodeMappingRef = useRef('');
  const doubaoCodingPlanDeprecationMessage =
    'Doubao Coding Plan 不再允许新增。根据火山方舟文档，Coding 套餐额度仅适用于 AI Coding 产品内调用，不适用于单独 API 调用；在非 AI Coding 产品中使用对应的 Base URL 和 API Key 可能被视为违规，并可能导致订阅停用或账号封禁。';
  const canKeepDeprecatedDoubaoCodingPlan =
    initialBaseUrlRef.current === DEPRECATED_DOUBAO_CODING_PLAN_BASE_URL;
  const doubaoCodingPlanOptionLabel = 'Doubao Coding Plan';

  // 2FA状态更新辅助函数
  const updateTwoFAState = (updates) => {
    setTwoFAState((prev) => ({ ...prev, ...updates }));
  };
  // 使用通用安全验证 Hook
  const {
    isModalVisible,
    verificationMethods,
    verificationState,
    withVerification,
    executeVerification,
    cancelVerification,
    setVerificationCode,
    switchVerificationMethod,
  } = useSecureVerification({
    onSuccess: (result) => {
      // 验证成功后显示密钥
      console.log('Verification success, result:', result);
      if (result && result.success && result.data?.key) {
        showSuccess(t('密钥获取成功'));
        setKeyDisplayState({
          showModal: true,
          keyData: result.data.key,
        });
      } else if (result && result.key) {
        // 直接返回了 key（没有包装在 data 中）
        showSuccess(t('密钥获取成功'));
        setKeyDisplayState({
          showModal: true,
          keyData: result.key,
        });
      }
    },
  });

  // 重置密钥显示状态
  const resetKeyDisplayState = () => {
    setKeyDisplayState({
      showModal: false,
      keyData: '',
    });
  };

  // 重置2FA验证状态
  const reset2FAVerifyState = () => {
    setShow2FAVerifyModal(false);
    setVerifyCode('');
    setVerifyLoading(false);
  };

  const handleApiConfigSecretClick = () => {
    if (inputs.type !== 45) return;
    const next = doubaoApiClickCountRef.current + 1;
    doubaoApiClickCountRef.current = next;
    if (next >= 10) {
      setDoubaoApiEditUnlocked((unlocked) => {
        if (!unlocked) {
          showInfo(t('已解锁豆包自定义 API 地址编辑'));
        }
        return true;
      });
    }
  };

  // 渠道额外设置状态
  const [channelSettings, setChannelSettings] = useState({
    force_format: false,
    thinking_to_content: false,
    proxy: '',
    pass_through_body_enabled: false,
    system_prompt: '',
  });
  const showApiConfigCard = true; // 控制是否显示 API 配置卡片
  const getInitValues = () => ({ ...originInputs });

  // 处理渠道额外设置的更新
  const handleChannelSettingsChange = (key, value) => {
    setChannelSettings((prev) => ({ ...prev, [key]: value }));
    setInputs((prev) => ({ ...prev, [key]: value }));
    const newSettings = { ...channelSettings, [key]: value };
    const settingsJson = JSON.stringify(newSettings);
    handleInputChange('setting', settingsJson);
  };

  const handleChannelOtherSettingsChange = (key, value) => {
    setChannelSettings((prev) => ({ ...prev, [key]: value }));
    setInputs((prev) => ({ ...prev, [key]: value }));
    let settings = {};
    if (inputs.settings) {
      try {
        settings = JSON.parse(inputs.settings);
      } catch (error) {
        console.error('解析设置失败:', error);
      }
    }
    settings[key] = value;
    const settingsJson = JSON.stringify(settings);
    handleInputChange('settings', settingsJson);
  };

  const applyClipboardConfig = (config) => {
    if (!config) return;
    setInputs((prev) => ({
      ...prev,
      key: config.key,
      base_url: config.url,
    }));
    setClipboardConfig(null);
    showSuccess(t('连接信息已填入'));
  };

  const pasteFromClipboard = async () => {
    if (!navigator?.clipboard?.readText) {
      showError(t('无法读取剪贴板'));
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      const parsed = parseChannelConnectionString(text);
      if (parsed) {
        applyClipboardConfig(parsed);
      } else {
        showInfo(t('剪贴板中未检测到连接信息'));
      }
    } catch {
      showError(t('无法读取剪贴板'));
    }
  };

  const isIonetLocked = isIonetChannel && isEdit;

  const handleInputChange = (name, value) => {
    if (
      isIonetChannel &&
      isEdit &&
      ['type', 'key', 'base_url'].includes(name)
    ) {
      return;
    }
    if (name === 'models' && Array.isArray(value)) {
      value = Array.from(new Set(value.map((m) => (m || '').trim())));
    }

    if (name === 'base_url' && typeof value === 'string' && value.endsWith('/v1')) {
      showConfirm({
        title: t('警告'),
        content: t('不需要在末尾加/v1，New API会自动处理，添加后可能导致请求失败，是否继续？'),
        onOk: () => {
          setInputs((inputs) => ({ ...inputs, [name]: value }));
        },
      });
      return;
    }
    setInputs((inputs) => ({ ...inputs, [name]: value }));
    if (name === 'type') {
      let localModels = [];
      switch (value) {
        case 2:
          localModels = [
            'mj_imagine',
            'mj_variation',
            'mj_reroll',
            'mj_blend',
            'mj_upscale',
            'mj_describe',
            'mj_uploads',
          ];
          break;
        case 5:
          localModels = [
            'swap_face',
            'mj_imagine',
            'mj_video',
            'mj_edits',
            'mj_variation',
            'mj_reroll',
            'mj_blend',
            'mj_upscale',
            'mj_describe',
            'mj_zoom',
            'mj_shorten',
            'mj_modal',
            'mj_inpaint',
            'mj_custom_zoom',
            'mj_high_variation',
            'mj_low_variation',
            'mj_pan',
            'mj_uploads',
          ];
          break;
        case 36:
          localModels = ['suno_music', 'suno_lyrics'];
          break;
        case 45:
          localModels = getChannelModels(value);
          setInputs((prevInputs) => ({
            ...prevInputs,
            base_url: 'https://ark.cn-beijing.volces.com',
          }));
          break;
        default:
          localModels = getChannelModels(value);
          break;
      }
      if (inputs.models.length === 0) {
        setInputs((inputs) => ({ ...inputs, models: localModels }));
      }
      setBasicModels(localModels);

      // 重置手动输入模式状态
      setUseManualInput(false);

      if (value === 57) {
        setBatch(false);
        setMultiToSingle(false);
        setMultiKeyMode('random');
        setVertexKeys([]);
        setVertexFileList([]);
        setInputs((prev) => ({ ...prev, vertex_files: [] }));
      }
    }
  };

  const formatJsonField = (fieldName) => {
    const rawValue = (inputs?.[fieldName] ?? '').trim();
    if (!rawValue) return;

    try {
      const parsed = JSON.parse(rawValue);
      handleInputChange(fieldName, JSON.stringify(parsed, null, 2));
    } catch (error) {
      showError(`${t('JSON格式错误')}: ${error.message}`);
    }
  };

  const formatUnixTime = (timestamp) => {
    const value = Number(timestamp || 0);
    if (!value) {
      return t('暂无');
    }
    return new Date(value * 1000).toLocaleString();
  };

  const copyParamOverrideJson = async () => {
    const raw =
      typeof inputs.param_override === 'string'
        ? inputs.param_override.trim()
        : '';
    if (!raw) {
      showInfo(t('暂无可复制 JSON'));
      return;
    }

    let content = raw;
    if (verifyJSON(raw)) {
      try {
        content = JSON.stringify(JSON.parse(raw), null, 2);
      } catch (error) {
        content = raw;
      }
    }

    const ok = await copy(content);
    if (ok) {
      showSuccess(t('参数覆盖 JSON 已复制'));
    } else {
      showError(t('复制失败'));
    }
  };

  const parseParamOverrideInput = () => {
    const raw =
      typeof inputs.param_override === 'string'
        ? inputs.param_override.trim()
        : '';
    if (!raw) return null;
    if (!verifyJSON(raw)) {
      throw new Error(t('当前参数覆盖不是合法的 JSON'));
    }
    return JSON.parse(raw);
  };

  const applyParamOverrideTemplate = (
    templateType = 'operations',
    applyMode = 'fill',
  ) => {
    try {
      const parsedCurrent = parseParamOverrideInput();
      if (templateType === 'legacy') {
        if (applyMode === 'fill') {
          handleInputChange(
            'param_override',
            JSON.stringify(PARAM_OVERRIDE_LEGACY_TEMPLATE, null, 2),
          );
          return;
        }
        const currentLegacy =
          parsedCurrent &&
          typeof parsedCurrent === 'object' &&
          !Array.isArray(parsedCurrent) &&
          !Array.isArray(parsedCurrent.operations)
            ? parsedCurrent
            : {};
        const merged = {
          ...PARAM_OVERRIDE_LEGACY_TEMPLATE,
          ...currentLegacy,
        };
        handleInputChange('param_override', JSON.stringify(merged, null, 2));
        return;
      }

      if (applyMode === 'fill') {
        handleInputChange(
          'param_override',
          JSON.stringify(PARAM_OVERRIDE_OPERATIONS_TEMPLATE, null, 2),
        );
        return;
      }
      const currentOperations =
        parsedCurrent &&
        typeof parsedCurrent === 'object' &&
        !Array.isArray(parsedCurrent) &&
        Array.isArray(parsedCurrent.operations)
          ? parsedCurrent.operations
          : [];
      const merged = {
        operations: [
          ...currentOperations,
          ...PARAM_OVERRIDE_OPERATIONS_TEMPLATE.operations,
        ],
      };
      handleInputChange('param_override', JSON.stringify(merged, null, 2));
    } catch (error) {
      showError(error.message || t('模板应用失败'));
    }
  };

  const clearParamOverride = () => {
    handleInputChange('param_override', '');
  };

  const loadChannel = async () => {
    setLoading(true);
    let res = await API.get(`/api/channel/${channelId}`);
    if (res === undefined) {
      return;
    }
    const { success, message, data } = res.data;
    if (success) {
      if (data.models === '') {
        data.models = [];
      } else {
        data.models = data.models.split(',');
      }
      if (data.group === '') {
        data.groups = [];
      } else {
        data.groups = data.group.split(',');
      }
      if (data.model_mapping !== '') {
        data.model_mapping = JSON.stringify(
          JSON.parse(data.model_mapping),
          null,
          2,
        );
      }
      const chInfo = data.channel_info || {};
      const isMulti = chInfo.is_multi_key === true;
      setIsMultiKeyChannel(isMulti);
      if (isMulti) {
        setBatch(true);
        setMultiToSingle(true);
        const modeVal = chInfo.multi_key_mode || 'random';
        setMultiKeyMode(modeVal);
        data.multi_key_mode = modeVal;
      } else {
        setBatch(false);
        setMultiToSingle(false);
      }
      // 解析渠道额外设置并合并到data中
      if (data.setting) {
        try {
          const parsedSettings = JSON.parse(data.setting);
          data.force_format = parsedSettings.force_format || false;
          data.thinking_to_content =
            parsedSettings.thinking_to_content || false;
          data.proxy = parsedSettings.proxy || '';
          data.pass_through_body_enabled =
            parsedSettings.pass_through_body_enabled || false;
          data.system_prompt = parsedSettings.system_prompt || '';
          data.system_prompt_override =
            parsedSettings.system_prompt_override || false;
        } catch (error) {
          console.error('解析渠道设置失败:', error);
          data.force_format = false;
          data.thinking_to_content = false;
          data.proxy = '';
          data.pass_through_body_enabled = false;
          data.system_prompt = '';
          data.system_prompt_override = false;
        }
      } else {
        data.force_format = false;
        data.thinking_to_content = false;
        data.proxy = '';
        data.pass_through_body_enabled = false;
        data.system_prompt = '';
        data.system_prompt_override = false;
      }

      if (data.settings) {
        try {
          const parsedSettings = JSON.parse(data.settings);
          data.azure_responses_version =
            parsedSettings.azure_responses_version || '';
          // 读取 Vertex 密钥格式
          data.vertex_key_type = parsedSettings.vertex_key_type || 'json';
          // 读取 AWS 密钥格式和区域
          data.aws_key_type = parsedSettings.aws_key_type || 'ak_sk';
          // 读取企业账户设置
          data.is_enterprise_account =
            parsedSettings.openrouter_enterprise === true;
          // 读取字段透传控制设置
          data.allow_service_tier = parsedSettings.allow_service_tier || false;
          data.disable_store = parsedSettings.disable_store || false;
          data.allow_safety_identifier =
            parsedSettings.allow_safety_identifier || false;
          data.allow_include_obfuscation =
            parsedSettings.allow_include_obfuscation || false;
          data.allow_inference_geo =
            parsedSettings.allow_inference_geo || false;
          data.allow_speed = parsedSettings.allow_speed || false;
          data.claude_beta_query = parsedSettings.claude_beta_query || false;
          data.upstream_model_update_check_enabled =
            parsedSettings.upstream_model_update_check_enabled === true;
          data.upstream_model_update_auto_sync_enabled =
            parsedSettings.upstream_model_update_auto_sync_enabled === true;
          data.upstream_model_update_last_check_time =
            Number(parsedSettings.upstream_model_update_last_check_time) || 0;
          data.upstream_model_update_last_detected_models = Array.isArray(
            parsedSettings.upstream_model_update_last_detected_models,
          )
            ? parsedSettings.upstream_model_update_last_detected_models
            : [];
          data.upstream_model_update_ignored_models = Array.isArray(
            parsedSettings.upstream_model_update_ignored_models,
          )
            ? parsedSettings.upstream_model_update_ignored_models.join(',')
            : '';
        } catch (error) {
          console.error('解析其他设置失败:', error);
          data.azure_responses_version = '';
          data.region = '';
          data.vertex_key_type = 'json';
          data.aws_key_type = 'ak_sk';
          data.is_enterprise_account = false;
          data.allow_service_tier = false;
          data.disable_store = false;
          data.allow_safety_identifier = false;
          data.allow_include_obfuscation = false;
          data.allow_inference_geo = false;
          data.allow_speed = false;
          data.claude_beta_query = false;
          data.upstream_model_update_check_enabled = false;
          data.upstream_model_update_auto_sync_enabled = false;
          data.upstream_model_update_last_check_time = 0;
          data.upstream_model_update_last_detected_models = [];
          data.upstream_model_update_ignored_models = '';
        }
      } else {
        // 兼容历史数据：老渠道没有 settings 时，默认按 json 展示
        data.vertex_key_type = 'json';
        data.aws_key_type = 'ak_sk';
        data.is_enterprise_account = false;
        data.allow_service_tier = false;
        data.disable_store = false;
        data.allow_safety_identifier = false;
        data.allow_include_obfuscation = false;
        data.allow_inference_geo = false;
        data.allow_speed = false;
        data.claude_beta_query = false;
        data.upstream_model_update_check_enabled = false;
        data.upstream_model_update_auto_sync_enabled = false;
        data.upstream_model_update_last_check_time = 0;
        data.upstream_model_update_last_detected_models = [];
        data.upstream_model_update_ignored_models = '';
      }

      if (
        data.type === 45 &&
        (!data.base_url ||
          (typeof data.base_url === 'string' && data.base_url.trim() === ''))
      ) {
        data.base_url = 'https://ark.cn-beijing.volces.com';
      }

      initialBaseUrlRef.current = data.base_url || '';
      setInputs(data);
      if (data.auto_ban === 0) {
        setAutoBan(false);
      } else {
        setAutoBan(true);
      }
      // 同步企业账户状态
      setIsEnterpriseAccount(data.is_enterprise_account || false);
      setBasicModels(getChannelModels(data.type));
      // 同步更新channelSettings状态显示
      setChannelSettings({
        force_format: data.force_format,
        thinking_to_content: data.thinking_to_content,
        proxy: data.proxy,
        pass_through_body_enabled: data.pass_through_body_enabled,
        system_prompt: data.system_prompt,
        system_prompt_override: data.system_prompt_override || false,
      });
      initialModelsRef.current = (data.models || [])
        .map((model) => (model || '').trim())
        .filter(Boolean);
      initialModelMappingRef.current = data.model_mapping || '';
      initialStatusCodeMappingRef.current = data.status_code_mapping || '';

      let parsedIonet = null;
      if (data.other_info) {
        try {
          const maybeMeta = JSON.parse(data.other_info);
          if (
            maybeMeta &&
            typeof maybeMeta === 'object' &&
            maybeMeta.source === 'ionet'
          ) {
            parsedIonet = maybeMeta;
          }
        } catch (error) {
          // ignore parse error
        }
      }
      const managedByIonet = !!parsedIonet;
      setIsIonetChannel(managedByIonet);
      setIonetMetadata(parsedIonet);

      // Smart expand: auto-open advanced settings if any advanced field has a value
      const hasAdvancedValues =
        (data.model_mapping && data.model_mapping.trim()) ||
        (data.param_override && data.param_override.trim()) ||
        (data.status_code_mapping && data.status_code_mapping.trim()) ||
        (data.header_override && data.header_override.trim()) ||
        (data.tag && data.tag.trim()) ||
        (data.remark && data.remark.trim()) ||
        (data.priority && data.priority !== 0) ||
        (data.weight && data.weight !== 0) ||
        (data.proxy && data.proxy.trim()) ||
        (data.system_prompt && data.system_prompt.trim()) ||
        data.thinking_to_content ||
        data.pass_through_body_enabled ||
        data.force_format ||
        data.claude_beta_query ||
        data.system_prompt_override;
      if (hasAdvancedValues) {
        setAdvancedSettingsOpen(true);
      }
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const fetchUpstreamModelList = async (name, options = {}) => {
    const silent = !!options.silent;
    // if (inputs['type'] !== 1) {
    //   showError(t('仅支持 OpenAI 接口格式'));
    //   return;
    // }
    setLoading(true);
    const models = [];
    let err = false;

    if (isEdit) {
      // 如果是编辑模式，使用已有的 channelId 获取模型列表
      const res = await API.get('/api/channel/fetch_models/' + channelId, {
        skipErrorHandler: true,
      });
      if (res && res.data && res.data.success) {
        models.push(...res.data.data);
      } else {
        err = true;
      }
    } else {
      // 如果是新建模式，通过后端代理获取模型列表
      if (!inputs?.['key']) {
        if (!silent) showError(t('请填写密钥'));
        err = true;
      } else {
        try {
          const res = await API.post(
            '/api/channel/fetch_models',
            {
              base_url: inputs['base_url'],
              type: inputs['type'],
              key: inputs['key'],
            },
            { skipErrorHandler: true },
          );

          if (res && res.data && res.data.success) {
            models.push(...res.data.data);
          } else {
            err = true;
          }
        } catch (error) {
          console.error('Error fetching models:', error);
          err = true;
        }
      }
    }

    if (!err) {
      const uniqueModels = Array.from(new Set(models));
      setFetchedModels(uniqueModels);
      if (!silent) {
        setModelModalVisible(true);
      }
      setLoading(false);
      return uniqueModels;
    } else {
      if (!silent) showError(t('获取模型列表失败'));
    }
    setLoading(false);
    return null;
  };

  const openModelMappingValueModal = async ({ pairKey, value }) => {
    const mappingKey = String(pairKey ?? '').trim();
    if (!mappingKey) return;

    if (!MODEL_FETCHABLE_CHANNEL_TYPES.has(inputs.type)) {
      return;
    }

    let modelsToUse = fetchedModels;
    if (!Array.isArray(modelsToUse) || modelsToUse.length === 0) {
      const fetched = await fetchUpstreamModelList('models', { silent: true });
      if (Array.isArray(fetched)) {
        modelsToUse = fetched;
      }
    }

    if (!Array.isArray(modelsToUse) || modelsToUse.length === 0) {
      showInfo(t('暂无模型'));
      return;
    }

    const normalizedModelsToUse = Array.from(
      new Set(
        modelsToUse.map((model) => String(model ?? '').trim()).filter(Boolean),
      ),
    );
    const currentValue = String(value ?? '').trim();

    setModelMappingValueModalModels(normalizedModelsToUse);
    setModelMappingValueKey(mappingKey);
    setModelMappingValueSelected(
      normalizedModelsToUse.includes(currentValue) ? currentValue : '',
    );
    setModelMappingValueModalVisible(true);
  };

  const fetchModels = async () => {
    try {
      let res = await API.get(`/api/channel/models`);
      const localModelOptions = res.data.data.map((model) => {
        const id = (model.id || '').trim();
        return {
          key: id,
          label: id,
          value: id,
        };
      });
      setOriginModelOptions(localModelOptions);
      setFullModels(res.data.data.map((model) => model.id));
      setBasicModels(
        res.data.data
          .filter((model) => {
            return model.id.startsWith('gpt-') || model.id.startsWith('text-');
          })
          .map((model) => model.id),
      );
    } catch (error) {
      showError(error.message);
    }
  };

  const fetchGroups = async () => {
    try {
      let res = await API.get(`/api/group/`);
      if (res === undefined) {
        return;
      }
      setGroupOptions(
        res.data.data.map((group) => ({
          label: group,
          value: group,
        })),
      );
    } catch (error) {
      showError(error.message);
    }
  };

  const fetchModelGroups = async () => {
    try {
      const res = await API.get('/api/prefill_group?type=model');
      if (res?.data?.success) {
        setModelGroups(res.data.data || []);
      }
    } catch (error) {
      // ignore
    }
  };

  // 查看渠道密钥（透明验证）
  const handleShow2FAModal = async () => {
    try {
      // 使用 withVerification 包装，会自动处理需要验证的情况
      const result = await withVerification(
        createApiCalls.viewChannelKey(channelId),
        {
          title: t('查看渠道密钥'),
          description: t('为了保护账户安全，请验证您的身份。'),
          preferredMethod: 'passkey', // 优先使用 Passkey
        },
      );

      // 如果直接返回了结果（已验证），显示密钥
      if (result && result.success && result.data?.key) {
        showSuccess(t('密钥获取成功'));
        setKeyDisplayState({
          showModal: true,
          keyData: result.data.key,
        });
      }
    } catch (error) {
      console.error('Failed to view channel key:', error);
      showError(error.message || t('获取密钥失败'));
    }
  };

  const handleCodexOAuthGenerated = (key) => {
    handleInputChange('key', key);
    formatJsonField('key');
  };

  const handleRefreshCodexCredential = async () => {
    if (!isEdit) return;

    setCodexCredentialRefreshing(true);
    try {
      const res = await API.post(
        `/api/channel/${channelId}/codex/refresh`,
        {},
        { skipErrorHandler: true },
      );
      if (!res?.data?.success) {
        throw new Error(res?.data?.message || 'Failed to refresh credential');
      }
      showSuccess(t('凭证已刷新'));
    } catch (error) {
      showError(error.message || t('刷新失败'));
    } finally {
      setCodexCredentialRefreshing(false);
    }
  };

  useEffect(() => {
    if (inputs.type !== 45) {
      doubaoApiClickCountRef.current = 0;
      setDoubaoApiEditUnlocked(false);
    }
  }, [inputs.type]);

  useEffect(() => {
    const modelMap = new Map();

    originModelOptions.forEach((option) => {
      const v = (option.value || '').trim();
      if (!modelMap.has(v)) {
        modelMap.set(v, option);
      }
    });

    inputs.models.forEach((model) => {
      const v = (model || '').trim();
      if (!modelMap.has(v)) {
        modelMap.set(v, {
          key: v,
          label: v,
          value: v,
        });
      }
    });

    const categories = getModelCategories(t);
    const optionsWithIcon = Array.from(modelMap.values()).map((opt) => {
      const modelName = opt.value;
      let icon = null;
      for (const [key, category] of Object.entries(categories)) {
        if (key !== 'all' && category.filter({ model_name: modelName })) {
          icon = category.icon;
          break;
        }
      }
      return {
        ...opt,
        label: (
          <span className='flex items-center gap-1'>
            {icon}
            {modelName}
          </span>
        ),
      };
    });

    setModelOptions(optionsWithIcon);
  }, [originModelOptions, inputs.models, t]);

  useEffect(() => {
    fetchModels().then();
    fetchGroups().then();
    if (!isEdit) {
      initialBaseUrlRef.current = '';
      setInputs(originInputs);
      let localModels = getChannelModels(inputs.type);
      setBasicModels(localModels);
      setInputs((inputs) => ({ ...inputs, models: localModels }));
    }
  }, [props.editingChannel.id]);

  // Removed legacy `formApiRef.setValues(inputs)` sync. After Semi <Form>
  // was dropped the formApi is just an adapter back into `inputs` itself,
  // so this effect would cause an infinite render loop.

  useEffect(() => {
    setModelSearchValue('');
    if (props.visible) {
      if (isEdit) {
        loadChannel();
      } else {
        formApiRef.current?.setValues(getInitValues());
        try {
          navigator?.clipboard?.readText()?.then((text) => {
            const parsed = parseChannelConnectionString(text);
            if (parsed) {
              setClipboardConfig(parsed);
            }
          }).catch(() => {});
        } catch {}
      }
      fetchModelGroups();
      // 重置手动输入模式状态
      setUseManualInput(false);
      // 编辑模式下恢复用户偏好，创建模式一律折叠
      setAdvancedSettingsOpen(
        isEdit && localStorage.getItem(ADVANCED_SETTINGS_EXPANDED_KEY) === 'true'
      );
    } else {
      // 统一的模态框关闭重置逻辑
      resetModalState();
    }
  }, [props.visible, channelId]);

  useEffect(() => {
    if (!isEdit) {
      initialModelsRef.current = [];
      initialModelMappingRef.current = '';
      initialStatusCodeMappingRef.current = '';
    }
  }, [isEdit, props.visible]);

  useEffect(() => {
    return () => {
      if (statusCodeRiskConfirmResolverRef.current) {
        statusCodeRiskConfirmResolverRef.current(false);
        statusCodeRiskConfirmResolverRef.current = null;
      }
    };
  }, []);

  // 统一的模态框重置函数
  const resetModalState = () => {
    resolveStatusCodeRiskConfirm(false);
    formApiRef.current?.reset();
    // 重置渠道设置状态
    setChannelSettings({
      force_format: false,
      thinking_to_content: false,
      proxy: '',
      pass_through_body_enabled: false,
      system_prompt: '',
      system_prompt_override: false,
    });
    // 重置密钥模式状态
    setKeyMode('append');
    // 重置企业账户状态
    setIsEnterpriseAccount(false);
    // 重置豆包隐藏入口状态
    setDoubaoApiEditUnlocked(false);
    doubaoApiClickCountRef.current = 0;
    setModelSearchValue('');
    // 重置高级设置折叠状态
    setAdvancedSettingsOpen(false);
    // 清空表单中的key_mode字段
    if (formApiRef.current) {
      formApiRef.current.setValue('key_mode', undefined);
    }
    // 重置本地输入，避免下次打开残留上一次的 JSON 字段值
    setInputs(getInitValues());
    // 重置密钥显示状态
    resetKeyDisplayState();
    // 重置剪贴板检测状态
    setClipboardConfig(null);
  };

  const handleVertexUploadChange = ({ fileList }) => {
    vertexErroredNames.current.clear();
    (async () => {
      let validFiles = [];
      let keys = [];
      const errorNames = [];
      for (const item of fileList) {
        const fileObj = item.fileInstance;
        if (!fileObj) continue;
        try {
          const txt = await fileObj.text();
          keys.push(JSON.parse(txt));
          validFiles.push(item);
        } catch (err) {
          if (!vertexErroredNames.current.has(item.name)) {
            errorNames.push(item.name);
            vertexErroredNames.current.add(item.name);
          }
        }
      }

      // 非批量模式下只保留一个文件（最新选择的），避免重复叠加
      if (!batch && validFiles.length > 1) {
        validFiles = [validFiles[validFiles.length - 1]];
        keys = [keys[keys.length - 1]];
      }

      setVertexKeys(keys);
      setVertexFileList(validFiles);
      if (formApiRef.current) {
        formApiRef.current.setValue('vertex_files', validFiles);
      }
      setInputs((prev) => ({ ...prev, vertex_files: validFiles }));

      if (errorNames.length > 0) {
        showError(
          t('以下文件解析失败，已忽略：{{list}}', {
            list: errorNames.join(', '),
          }),
        );
      }
    })();
  };

  const [missingModelsModal, setMissingModelsModal] = useState({
    visible: false,
    models: [],
    resolve: null,
  });
  const confirmMissingModelMappings = (missingModels) =>
    new Promise((resolve) => {
      setMissingModelsModal({ visible: true, models: missingModels, resolve });
    });
  const closeMissingModelsModal = (action) => {
    if (missingModelsModal.resolve) missingModelsModal.resolve(action);
    setMissingModelsModal({ visible: false, models: [], resolve: null });
  };

  const resolveStatusCodeRiskConfirm = (confirmed) => {
    setStatusCodeRiskConfirmVisible(false);
    setStatusCodeRiskDetailItems([]);
    if (statusCodeRiskConfirmResolverRef.current) {
      statusCodeRiskConfirmResolverRef.current(confirmed);
      statusCodeRiskConfirmResolverRef.current = null;
    }
  };

  const confirmStatusCodeRisk = (detailItems) =>
    new Promise((resolve) => {
      statusCodeRiskConfirmResolverRef.current = resolve;
      setStatusCodeRiskDetailItems(detailItems);
      setStatusCodeRiskConfirmVisible(true);
    });

  const hasModelConfigChanged = (normalizedModels, modelMappingStr) => {
    if (!isEdit) return true;
    const initialModels = initialModelsRef.current;
    if (normalizedModels.length !== initialModels.length) {
      return true;
    }
    for (let i = 0; i < normalizedModels.length; i++) {
      if (normalizedModels[i] !== initialModels[i]) {
        return true;
      }
    }
    const normalizedMapping = (modelMappingStr || '').trim();
    const initialMapping = (initialModelMappingRef.current || '').trim();
    return normalizedMapping !== initialMapping;
  };

  const submit = async () => {
    const formValues = formApiRef.current ? formApiRef.current.getValues() : {};
    let localInputs = { ...formValues };
    localInputs.param_override = inputs.param_override;

    if (localInputs.type === 57) {
      if (batch) {
        showInfo(t('Codex 渠道不支持批量创建'));
        return;
      }

      const rawKey = (localInputs.key || '').trim();
      if (!isEdit && rawKey === '') {
        showInfo(t('请输入密钥！'));
        return;
      }

      if (rawKey !== '') {
        if (!verifyJSON(rawKey)) {
          showInfo(t('密钥必须是合法的 JSON 格式！'));
          return;
        }
        try {
          const parsed = JSON.parse(rawKey);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            showInfo(t('密钥必须是 JSON 对象'));
            return;
          }
          const accessToken = String(parsed.access_token || '').trim();
          const accountId = String(parsed.account_id || '').trim();
          if (!accessToken) {
            showInfo(t('密钥 JSON 必须包含 access_token'));
            return;
          }
          if (!accountId) {
            showInfo(t('密钥 JSON 必须包含 account_id'));
            return;
          }
          localInputs.key = JSON.stringify(parsed);
        } catch (error) {
          showInfo(t('密钥必须是合法的 JSON 格式！'));
          return;
        }
      }
    }

    if (localInputs.type === 41) {
      const keyType = localInputs.vertex_key_type || 'json';
      if (keyType === 'api_key') {
        // 直接作为普通字符串密钥处理
        if (!isEdit && (!localInputs.key || localInputs.key.trim() === '')) {
          showInfo(t('请输入密钥！'));
          return;
        }
      } else {
        // JSON 服务账号密钥
        if (useManualInput) {
          if (localInputs.key && localInputs.key.trim() !== '') {
            try {
              const parsedKey = JSON.parse(localInputs.key);
              localInputs.key = JSON.stringify(parsedKey);
            } catch (err) {
              showError(t('密钥格式无效，请输入有效的 JSON 格式密钥'));
              return;
            }
          } else if (!isEdit) {
            showInfo(t('请输入密钥！'));
            return;
          }
        } else {
          // 文件上传模式
          let keys = vertexKeys;
          if (keys.length === 0 && vertexFileList.length > 0) {
            try {
              const parsed = await Promise.all(
                vertexFileList.map(async (item) => {
                  const fileObj = item.fileInstance;
                  if (!fileObj) return null;
                  const txt = await fileObj.text();
                  return JSON.parse(txt);
                }),
              );
              keys = parsed.filter(Boolean);
            } catch (err) {
              showError(t('解析密钥文件失败: {{msg}}', { msg: err.message }));
              return;
            }
          }
          if (keys.length === 0) {
            if (!isEdit) {
              showInfo(t('请上传密钥文件！'));
              return;
            } else {
              delete localInputs.key;
            }
          } else {
            localInputs.key = batch
              ? JSON.stringify(keys)
              : JSON.stringify(keys[0]);
          }
        }
      }
    }

    // 如果是编辑模式且 key 为空字符串，避免提交空值覆盖旧密钥
    if (isEdit && (!localInputs.key || localInputs.key.trim() === '')) {
      delete localInputs.key;
    }
    delete localInputs.vertex_files;

    if (!isEdit && (!localInputs.name || !localInputs.key)) {
      showInfo(t('请填写渠道名称和渠道密钥！'));
      return;
    }
    if (!Array.isArray(localInputs.models) || localInputs.models.length === 0) {
      showInfo(t('请至少选择一个模型！'));
      return;
    }
    if (
      localInputs.type === 45 &&
      (!localInputs.base_url || localInputs.base_url.trim() === '')
    ) {
      showInfo(t('请输入API地址！'));
      return;
    }
    const hasModelMapping =
      typeof localInputs.model_mapping === 'string' &&
      localInputs.model_mapping.trim() !== '';
    let parsedModelMapping = null;
    if (hasModelMapping) {
      if (!verifyJSON(localInputs.model_mapping)) {
        showInfo(t('模型映射必须是合法的 JSON 格式！'));
        return;
      }
      try {
        parsedModelMapping = JSON.parse(localInputs.model_mapping);
      } catch (error) {
        showInfo(t('模型映射必须是合法的 JSON 格式！'));
        return;
      }
    }

    const normalizedModels = (localInputs.models || [])
      .map((model) => (model || '').trim())
      .filter(Boolean);
    localInputs.models = normalizedModels;

    if (
      parsedModelMapping &&
      typeof parsedModelMapping === 'object' &&
      !Array.isArray(parsedModelMapping)
    ) {
      const modelSet = new Set(normalizedModels);
      const missingModels = Object.keys(parsedModelMapping)
        .map((key) => (key || '').trim())
        .filter((key) => key && !modelSet.has(key));
      const shouldPromptMissing =
        missingModels.length > 0 &&
        hasModelConfigChanged(normalizedModels, localInputs.model_mapping);
      if (shouldPromptMissing) {
        const confirmAction = await confirmMissingModelMappings(missingModels);
        if (confirmAction === 'cancel') {
          return;
        }
        if (confirmAction === 'add') {
          const updatedModels = Array.from(
            new Set([...normalizedModels, ...missingModels]),
          );
          localInputs.models = updatedModels;
          handleInputChange('models', updatedModels);
        }
      }
    }

    const invalidStatusCodeEntries = collectInvalidStatusCodeEntries(
      localInputs.status_code_mapping,
    );
    if (invalidStatusCodeEntries.length > 0) {
      showError(
        `${t('状态码复写包含无效的状态码')}: ${invalidStatusCodeEntries.join(', ')}`,
      );
      return;
    }

    const riskyStatusCodeRedirects = collectNewDisallowedStatusCodeRedirects(
      initialStatusCodeMappingRef.current,
      localInputs.status_code_mapping,
    );
    if (riskyStatusCodeRedirects.length > 0) {
      const confirmed = await confirmStatusCodeRisk(riskyStatusCodeRedirects);
      if (!confirmed) {
        return;
      }
    }

    if (localInputs.base_url && localInputs.base_url.endsWith('/')) {
      localInputs.base_url = localInputs.base_url.slice(
        0,
        localInputs.base_url.length - 1,
      );
    }
    if (localInputs.type === 18 && localInputs.other === '') {
      localInputs.other = 'v2.1';
    }

    // 生成渠道额外设置JSON
    const channelExtraSettings = {
      force_format: localInputs.force_format || false,
      thinking_to_content: localInputs.thinking_to_content || false,
      proxy: localInputs.proxy || '',
      pass_through_body_enabled: localInputs.pass_through_body_enabled || false,
      system_prompt: localInputs.system_prompt || '',
      system_prompt_override: localInputs.system_prompt_override || false,
    };
    localInputs.setting = JSON.stringify(channelExtraSettings);

    // 处理 settings 字段（包括企业账户设置和字段透传控制）
    let settings = {};
    if (localInputs.settings) {
      try {
        settings = JSON.parse(localInputs.settings);
      } catch (error) {
        console.error('解析settings失败:', error);
      }
    }

    // type === 20: 设置企业账户标识，无论是true还是false都要传到后端
    if (localInputs.type === 20) {
      settings.openrouter_enterprise =
        localInputs.is_enterprise_account === true;
    }

    // type === 33 (AWS): 保存 aws_key_type 到 settings
    if (localInputs.type === 33) {
      settings.aws_key_type = localInputs.aws_key_type || 'ak_sk';
    }

    // type === 41 (Vertex): 始终保存 vertex_key_type 到 settings，避免编辑时被重置
    if (localInputs.type === 41) {
      settings.vertex_key_type = localInputs.vertex_key_type || 'json';
    } else if ('vertex_key_type' in settings) {
      delete settings.vertex_key_type;
    }

    // type === 1 (OpenAI) 或 type === 14 (Claude): 设置字段透传控制（显式保存布尔值）
    if (localInputs.type === 1 || localInputs.type === 14) {
      settings.allow_service_tier = localInputs.allow_service_tier === true;
      // 仅 OpenAI 渠道需要 store / safety_identifier / include_obfuscation
      if (localInputs.type === 1) {
        settings.disable_store = localInputs.disable_store === true;
        settings.allow_safety_identifier =
          localInputs.allow_safety_identifier === true;
        settings.allow_include_obfuscation =
          localInputs.allow_include_obfuscation === true;
      }
      if (localInputs.type === 14) {
        settings.allow_inference_geo = localInputs.allow_inference_geo === true;
        settings.allow_speed = localInputs.allow_speed === true;
        settings.claude_beta_query = localInputs.claude_beta_query === true;
      }
    }

    settings.upstream_model_update_check_enabled =
      localInputs.upstream_model_update_check_enabled === true;
    settings.upstream_model_update_auto_sync_enabled =
      settings.upstream_model_update_check_enabled &&
      localInputs.upstream_model_update_auto_sync_enabled === true;
    settings.upstream_model_update_ignored_models = Array.from(
      new Set(
        String(localInputs.upstream_model_update_ignored_models || '')
          .split(',')
          .map((model) => model.trim())
          .filter(Boolean),
      ),
    );
    if (
      !Array.isArray(settings.upstream_model_update_last_detected_models) ||
      !settings.upstream_model_update_check_enabled
    ) {
      settings.upstream_model_update_last_detected_models = [];
    }
    if (typeof settings.upstream_model_update_last_check_time !== 'number') {
      settings.upstream_model_update_last_check_time = 0;
    }

    localInputs.settings = JSON.stringify(settings);

    // 清理不需要发送到后端的字段
    delete localInputs.force_format;
    delete localInputs.thinking_to_content;
    delete localInputs.proxy;
    delete localInputs.pass_through_body_enabled;
    delete localInputs.system_prompt;
    delete localInputs.system_prompt_override;
    delete localInputs.is_enterprise_account;
    // 顶层的 vertex_key_type 不应发送给后端
    delete localInputs.vertex_key_type;
    // 顶层的 aws_key_type 不应发送给后端
    delete localInputs.aws_key_type;
    // 清理字段透传控制的临时字段
    delete localInputs.allow_service_tier;
    delete localInputs.disable_store;
    delete localInputs.allow_safety_identifier;
    delete localInputs.allow_include_obfuscation;
    delete localInputs.allow_inference_geo;
    delete localInputs.allow_speed;
    delete localInputs.claude_beta_query;
    delete localInputs.upstream_model_update_check_enabled;
    delete localInputs.upstream_model_update_auto_sync_enabled;
    delete localInputs.upstream_model_update_last_check_time;
    delete localInputs.upstream_model_update_last_detected_models;
    delete localInputs.upstream_model_update_ignored_models;

    let res;
    localInputs.auto_ban = localInputs.auto_ban ? 1 : 0;
    localInputs.models = localInputs.models.join(',');
    localInputs.group = (localInputs.groups || []).join(',');

    let mode = 'single';
    if (batch) {
      mode = multiToSingle ? 'multi_to_single' : 'batch';
    }

    if (isEdit) {
      res = await API.put(`/api/channel/`, {
        ...localInputs,
        id: parseInt(channelId),
        key_mode: isMultiKeyChannel ? keyMode : undefined, // 只在多key模式下传递
      });
    } else {
      res = await API.post(`/api/channel/`, {
        mode: mode,
        multi_key_mode: mode === 'multi_to_single' ? multiKeyMode : undefined,
        channel: localInputs,
      });
    }
    const { success, message } = res.data;
    if (success) {
      if (isEdit) {
        showSuccess(t('渠道更新成功！'));
      } else {
        showSuccess(t('渠道创建成功！'));
        setInputs(originInputs);
      }
      props.refresh();
      props.handleClose();
    } else {
      showError(message);
    }
  };

  // 密钥去重函数
  const deduplicateKeys = () => {
    const currentKey = formApiRef.current?.getValue('key') || inputs.key || '';

    if (!currentKey.trim()) {
      showInfo(t('请先输入密钥'));
      return;
    }

    // 按行分割密钥
    const keyLines = currentKey.split('\n');
    const beforeCount = keyLines.length;

    // 使用哈希表去重，保持原有顺序
    const keySet = new Set();
    const deduplicatedKeys = [];

    keyLines.forEach((line) => {
      const trimmedLine = line.trim();
      if (trimmedLine && !keySet.has(trimmedLine)) {
        keySet.add(trimmedLine);
        deduplicatedKeys.push(trimmedLine);
      }
    });

    const afterCount = deduplicatedKeys.length;
    const deduplicatedKeyText = deduplicatedKeys.join('\n');

    // 更新表单和状态
    if (formApiRef.current) {
      formApiRef.current.setValue('key', deduplicatedKeyText);
    }
    handleInputChange('key', deduplicatedKeyText);

    // 显示去重结果
    const message = t(
      '去重完成：去重前 {{before}} 个密钥，去重后 {{after}} 个密钥',
      {
        before: beforeCount,
        after: afterCount,
      },
    );

    if (beforeCount === afterCount) {
      showInfo(t('未发现重复密钥'));
    } else {
      showSuccess(message);
    }
  };

  const addCustomModels = () => {
    if (customModel.trim() === '') return;
    const modelArray = customModel.split(',').map((model) => model.trim());

    let localModels = [...inputs.models];
    let localModelOptions = [...modelOptions];
    const addedModels = [];

    modelArray.forEach((model) => {
      if (model && !localModels.includes(model)) {
        localModels.push(model);
        localModelOptions.push({
          key: model,
          label: model,
          value: model,
        });
        addedModels.push(model);
      }
    });

    setModelOptions(localModelOptions);
    setCustomModel('');
    handleInputChange('models', localModels);

    if (addedModels.length > 0) {
      showSuccess(
        t('已新增 {{count}} 个模型：{{list}}', {
          count: addedModels.length,
          list: addedModels.join(', '),
        }),
      );
    } else {
      showInfo(t('未发现新增模型'));
    }
  };

  const batchAllowed = (!isEdit || isMultiKeyChannel) && inputs.type !== 57;

  return (
    <>
      <SlideOver
        placement={isEdit ? 'right' : 'left'}
        open={props.visible}
        onClose={() => handleCancel()}
        width={isMobile ? window.innerWidth : 600}
        title={
          <>
            <span className='inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400'>
              {isEdit ? t('编辑') : t('新建')}
            </span>
            <span className='text-base font-semibold text-ui-text truncate'>
              {isEdit ? t('更新渠道信息') : t('创建新的渠道')}
            </span>
          </>
        }
        headerExtra={
          !isEdit ? (
            <Button variant='secondary' size='sm' icon={Zap} onClick={pasteFromClipboard}>
              {t('从剪贴板粘贴配置')}
            </Button>
          ) : null
        }
        footer={
          <>
            <Button variant='secondary' onClick={handleCancel}>
              {t('取消')}
            </Button>
            <Button onClick={submit}>
              {t('提交')}
            </Button>
          </>
        }
        bodyClass='p-5'
      >
        {loading ? (
          <div className='flex items-center justify-center py-16 text-ui-text-3 text-sm'>
            <Loader2 size={16} className='animate-spin mr-2' />
            {t('加载中...')}
          </div>
        ) : (
          <div className='space-y-5' ref={formContainerRef}>
            {/* Clipboard config notice */}
            {!isEdit && clipboardConfig && (
              <Notice
                kind='info'
                action={
                  <div className='flex gap-1'>
                    <Button size='sm' onClick={() => applyClipboardConfig(clipboardConfig)}>
                      {t('自动填入')}
                    </Button>
                    <Button size='sm' variant='ghost' onClick={() => setClipboardConfig(null)}>
                      {t('忽略')}
                    </Button>
                  </div>
                }
              >
                {t('检测到剪贴板中的连接信息')}
              </Notice>
            )}

            {/* Core configuration */}
            <Section title={t('核心配置')}>
              {isIonetChannel && (
                <Notice
                  kind='info'
                  action={
                    ionetMetadata?.deployment_id ? (
                      <Button size='sm' variant='ghost' onClick={handleOpenIonetDeployment}>
                        {t('查看关联部署')}
                      </Button>
                    ) : null
                  }
                >
                  {t('此渠道由 IO.NET 自动同步，类型、密钥和 API 地址已锁定。')}
                </Notice>
              )}

              {/* Type combobox */}
              <FieldRow label={t('类型')} required>
                <Combobox
                  value={inputs.type}
                  onChange={(value) => handleInputChange('type', value)}
                  disabled={isIonetLocked}
                  placeholder={t('请选择渠道类型')}
                  options={CHANNEL_OPTIONS.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                  renderOption={(o, kw) => (
                    <>
                      <span className='flex-shrink-0 w-4 h-4 inline-flex items-center justify-center'>
                        {getChannelIcon(o.value)}
                      </span>
                      <span className='truncate'>
                        <HighlightText text={o.label} query={kw} />
                      </span>
                    </>
                  )}
                />
              </FieldRow>

              {/* Codex disclaimer */}
              {inputs.type === 57 && (
                <Notice kind='warning'>
                  {t(
                    '免责声明：仅限个人使用，请勿分发或共享任何凭证。该渠道存在前置条件与使用门槛，请在充分了解流程与风险后使用，并遵守 OpenAI 的相关条款与政策。相关凭证与配置仅限接入 Codex CLI 使用，不适用于其他客户端、平台或渠道。',
                  )}
                </Notice>
              )}

              {/* Enterprise account toggle (OpenRouter type 20) */}
              {inputs.type === 20 && (
                <ToggleField
                  label={t('是否为企业账户')}
                  hint={t('企业账户为特殊返回格式，需要特殊处理，如果非企业账户，请勿勾选')}
                  checked={!!inputs.is_enterprise_account}
                  onChange={(v) => {
                    setIsEnterpriseAccount(v);
                    handleInputChange('is_enterprise_account', v);
                  }}
                />
              )}

              {/* Name */}
              <FieldRow label={t('名称')} required>
                <TextField
                  value={inputs.name}
                  onChange={(v) => handleInputChange('name', v)}
                  placeholder={t('请为渠道命名')}
                  autoComplete='new-password'
                />
              </FieldRow>

              {/* AWS key type */}
              {inputs.type === 33 && (
                <FieldRow
                  label={t('密钥格式')}
                  hint={t('AK/SK 模式：使用 AccessKey 和 SecretAccessKey；API Key 模式：使用 API Key')}
                >
                  <NativeSelect
                    value={inputs.aws_key_type || 'ak_sk'}
                    onChange={(v) => handleChannelOtherSettingsChange('aws_key_type', v)}
                    options={[
                      { value: 'ak_sk', label: 'AccessKey / SecretAccessKey' },
                      { value: 'api_key', label: 'API Key' },
                    ]}
                  />
                </FieldRow>
              )}

              {/* Vertex key type */}
              {inputs.type === 41 && (
                <FieldRow
                  label={t('密钥格式')}
                  hint={
                    inputs.vertex_key_type === 'api_key'
                      ? t('API Key 模式下不支持批量创建')
                      : t('JSON 模式支持手动输入或上传服务账号 JSON')
                  }
                >
                  <NativeSelect
                    value={inputs.vertex_key_type || 'json'}
                    onChange={(v) => {
                      handleChannelOtherSettingsChange('vertex_key_type', v);
                      if (v === 'api_key') {
                        setBatch(false);
                        setUseManualInput(false);
                        setVertexKeys([]);
                        setVertexFileList([]);
                        setInputs((prev) => ({ ...prev, vertex_files: [] }));
                      }
                    }}
                    options={[
                      { value: 'json', label: 'JSON' },
                      { value: 'api_key', label: 'API Key' },
                    ]}
                  />
                </FieldRow>
              )}

              {/* Batch toggle (only when allowed) */}
              {batchAllowed && !isEdit && (
                <ToggleField
                  label={t('批量创建')}
                  checked={batch}
                  onChange={(checked) => {
                    if (!checked && vertexFileList.length > 1) {
                      showConfirm({
                        title: t('切换为单密钥模式'),
                        content: t('将仅保留第一个密钥文件，其余文件将被移除，是否继续？'),
                        onOk: () => {
                          const firstFile = vertexFileList[0];
                          const firstKey = vertexKeys[0] ? [vertexKeys[0]] : [];
                          setVertexFileList([firstFile]);
                          setVertexKeys(firstKey);
                          setInputs((prev) => ({ ...prev, vertex_files: [firstFile] }));
                          setBatch(false);
                          setMultiToSingle(false);
                          setMultiKeyMode('random');
                        },
                      });
                      return;
                    }
                    setBatch(checked);
                    if (!checked) {
                      setMultiToSingle(false);
                      setMultiKeyMode('random');
                    } else {
                      setUseManualInput(false);
                      if (inputs.type === 41) handleInputChange('key', '');
                    }
                  }}
                />
              )}

              {batch && (
                <ToggleField
                  label={t('密钥聚合模式')}
                  checked={multiToSingle}
                  onChange={() => {
                    setMultiToSingle((prev) => {
                      const next = !prev;
                      setInputs((p) => {
                        const n = { ...p };
                        if (next) n.multi_key_mode = multiKeyMode;
                        else delete n.multi_key_mode;
                        return n;
                      });
                      return next;
                    });
                  }}
                />
              )}

              {/* Key input — type-specific branches */}
              {(() => {
                // Vertex JSON file upload (batch or non-batch file mode)
                const vertexFileMode =
                  inputs.type === 41 &&
                  (inputs.vertex_key_type || 'json') === 'json' &&
                  (batch || !useManualInput);

                if (vertexFileMode) {
                  return (
                    <FieldRow
                      label={t('密钥文件 (.json)')}
                      hint={batch ? t('支持多文件') : t('仅支持 JSON 文件')}
                      extra={
                        !batch && (
                          <UITabs
                            size='sm'
                            value={useManualInput ? 'manual' : 'file'}
                            onChange={(v) => {
                              if (v === 'file') {
                                setUseManualInput(false);
                                handleInputChange('key', '');
                              } else {
                                setUseManualInput(true);
                                setVertexKeys([]);
                                setVertexFileList([]);
                                setInputs((prev) => ({ ...prev, vertex_files: [] }));
                              }
                            }}
                            items={[
                              { value: 'file', label: t('文件上传') },
                              { value: 'manual', label: t('手动输入') },
                            ]}
                          />
                        )
                      }
                    >
                      <label className='flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-xl border border-dashed border-ui-border bg-ui-bg-subtle hover:bg-ui-bg cursor-pointer transition-colors'>
                        <Zap size={18} className='text-ui-text-3' />
                        <span className='text-xs text-ui-text-2'>
                          {t('点击上传文件或拖拽文件到这里')}
                        </span>
                        <input
                          type='file'
                          accept='.json'
                          multiple={batch}
                          className='hidden'
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []).map((f) => ({
                              name: f.name,
                              fileInstance: f,
                            }));
                            handleVertexUploadChange({ fileList: files });
                            e.target.value = '';
                          }}
                        />
                      </label>
                      {vertexFileList.length > 0 && (
                        <div className='flex flex-wrap gap-1 mt-2'>
                          {vertexFileList.map((f, i) => (
                            <Chip
                              key={i}
                              onRemove={() => {
                                const next = vertexFileList.filter((_, idx) => idx !== i);
                                const nextKeys = vertexKeys.filter((_, idx) => idx !== i);
                                setVertexFileList(next);
                                setVertexKeys(nextKeys);
                                setInputs((prev) => ({ ...prev, vertex_files: next }));
                              }}
                            >
                              {f.name}
                            </Chip>
                          ))}
                        </div>
                      )}
                    </FieldRow>
                  );
                }

                const isCodex = inputs.type === 57;
                const isAwsAkSk = inputs.type === 33 && inputs.aws_key_type !== 'api_key';
                const isLargeKey = batch || isCodex || (inputs.type === 41 && useManualInput);

                const placeholder = isCodex
                  ? t('请输入 JSON 格式的 OAuth 凭据，例如：\n{\n  "access_token": "...",\n  "account_id": "..." \n}')
                  : inputs.type === 41 && useManualInput
                    ? t('请输入 JSON 格式的密钥内容')
                    : batch
                      ? inputs.type === 33
                        ? inputs.aws_key_type === 'api_key'
                          ? t('请输入 API Key，一行一个，格式：APIKey|Region')
                          : t('请输入密钥，一行一个，格式：AccessKey|SecretAccessKey|Region')
                        : t('请输入密钥，一行一个')
                      : inputs.type === 33
                        ? inputs.aws_key_type === 'api_key'
                          ? t('请输入 API Key，格式：APIKey|Region')
                          : t('按照如下格式输入：AccessKey|SecretAccessKey|Region')
                        : t(type2secretPrompt(inputs.type));

                return (
                  <FieldRow
                    label={isEdit ? t('密钥（编辑模式下，保存的密钥不会显示）') : t('密钥')}
                    required={!isEdit}
                    extra={
                      <div className='flex flex-wrap items-center gap-1'>
                        {isCodex && (
                          <Button
                            size='sm'
                            variant='ghost'
                            onClick={() => setCodexOAuthModalVisible(true)}
                            disabled={isIonetLocked}
                          >
                            {t('Codex 授权')}
                          </Button>
                        )}
                        {isCodex && isEdit && (
                          <Button
                            size='sm'
                            variant='ghost'
                            icon={codexCredentialRefreshing ? Loader2 : undefined}
                            onClick={handleRefreshCodexCredential}
                            disabled={isIonetLocked || codexCredentialRefreshing}
                          >
                            {t('刷新凭证')}
                          </Button>
                        )}
                        {isCodex && (
                          <Button
                            size='sm'
                            variant='ghost'
                            onClick={() => formatJsonField('key')}
                            disabled={isIonetLocked}
                          >
                            {t('格式化')}
                          </Button>
                        )}
                        {batch && inputs.type !== 41 && (
                          <Button size='sm' variant='ghost' onClick={deduplicateKeys}>
                            {t('密钥去重')}
                          </Button>
                        )}
                        {isEdit && (
                          <Button size='sm' variant='ghost' onClick={handleShow2FAModal}>
                            {t('查看密钥')}
                          </Button>
                        )}
                      </div>
                    }
                    hint={
                      isEdit && isMultiKeyChannel && keyMode === 'append'
                        ? t('追加模式：新密钥将添加到现有密钥列表的末尾')
                        : isCodex
                          ? t('仅支持 JSON 对象，必须包含 access_token 与 account_id')
                          : undefined
                    }
                  >
                    {isLargeKey ? (
                      <TextAreaField
                        value={inputs.key || ''}
                        onChange={(v) => handleInputChange('key', v)}
                        placeholder={placeholder}
                        rows={isCodex ? 6 : 4}
                        disabled={isIonetLocked}
                        autoComplete='new-password'
                      />
                    ) : (
                      <TextField
                        value={inputs.key || ''}
                        onChange={(v) => handleInputChange('key', v)}
                        placeholder={placeholder}
                        autoComplete='new-password'
                        disabled={isIonetLocked}
                      />
                    )}
                  </FieldRow>
                );
              })()}

              {/* Codex OAuth modal mounted near key field */}
              {inputs.type === 57 && (
                <CodexOAuthModal
                  visible={codexOAuthModalVisible}
                  onCancel={() => setCodexOAuthModalVisible(false)}
                  onSuccess={handleCodexOAuthGenerated}
                />
              )}

              {/* Multi-key update mode (edit mode of multi-key channel) */}
              {isEdit && isMultiKeyChannel && (
                <FieldRow
                  label={t('密钥更新模式')}
                  hint={
                    keyMode === 'replace'
                      ? t('覆盖模式：将完全替换现有的所有密钥')
                      : t('追加模式：将新密钥添加到现有密钥列表末尾')
                  }
                >
                  <NativeSelect
                    value={keyMode}
                    onChange={(v) => setKeyMode(v)}
                    options={[
                      { value: 'append', label: t('追加到现有密钥') },
                      { value: 'replace', label: t('覆盖现有密钥') },
                    ]}
                  />
                </FieldRow>
              )}

              {/* multi_key_mode select when batch + multiToSingle */}
              {batch && multiToSingle && (
                <FieldRow label={t('密钥聚合模式')}>
                  <NativeSelect
                    value={inputs.multi_key_mode || 'random'}
                    onChange={(v) => {
                      setMultiKeyMode(v);
                      handleInputChange('multi_key_mode', v);
                    }}
                    options={[
                      { value: 'random', label: t('随机') },
                      { value: 'polling', label: t('轮询') },
                    ]}
                  />
                  {inputs.multi_key_mode === 'polling' && (
                    <div className='mt-2'>
                      <Notice kind='warning'>
                        {t('轮询模式必须搭配Redis和内存缓存功能使用，否则性能将大幅降低，并且无法实现轮询功能')}
                      </Notice>
                    </div>
                  )}
                </FieldRow>
              )}

              {/* Type-specific 'other' fields */}
              {inputs.type === 18 && (
                <FieldRow label={t('模型版本')}>
                  <TextField
                    value={inputs.other || ''}
                    onChange={(v) => handleInputChange('other', v)}
                    placeholder='请输入星火大模型版本，注意是接口地址中的版本号，例如：v2.1'
                  />
                </FieldRow>
              )}
              {inputs.type === 41 && (
                <JSONEditor
                  key={`region-${isEdit ? channelId : 'new'}`}
                  field='other'
                  label={t('部署地区')}
                  placeholder={t(
                    '请输入部署地区，例如：us-central1\n支持使用模型映射格式\n{\n    "default": "us-central1",\n    "claude-3-5-sonnet-20240620": "europe-west1"\n}',
                  )}
                  value={inputs.other || ''}
                  onChange={(v) => handleInputChange('other', v)}
                  template={REGION_EXAMPLE}
                  templateLabel={t('填入模板')}
                  editorType='region'
                  formApi={formApiRef.current}
                  extraText={t('设置默认地区和特定模型的专用地区')}
                />
              )}
              {inputs.type === 21 && (
                <FieldRow label={t('知识库 ID')}>
                  <TextField value={inputs.other || ''} onChange={(v) => handleInputChange('other', v)} placeholder='请输入知识库 ID，例如：123456' />
                </FieldRow>
              )}
              {inputs.type === 39 && (
                <FieldRow label='Account ID'>
                  <TextField value={inputs.other || ''} onChange={(v) => handleInputChange('other', v)} placeholder='请输入Account ID，例如：d6b5da8hk1awo8nap34ube6gh' />
                </FieldRow>
              )}
              {inputs.type === 49 && (
                <FieldRow label={t('智能体ID')}>
                  <TextField value={inputs.other || ''} onChange={(v) => handleInputChange('other', v)} placeholder='请输入智能体ID，例如：7342866812345' />
                </FieldRow>
              )}

              {/* OpenAI organization */}
              {inputs.type === 1 && (
                <FieldRow label={t('组织')} hint={t('组织，不填则为默认组织')}>
                  <TextField
                    value={inputs.openai_organization || ''}
                    onChange={(v) => handleInputChange('openai_organization', v)}
                    placeholder={t('请输入组织org-xxx')}
                  />
                </FieldRow>
              )}

              {/* Base URL block — type-specific */}
              <div onClick={handleApiConfigSecretClick}>
                {inputs.type === 40 && (
                  <Notice kind='info'>
                    <span className='font-semibold'>{t('邀请链接')}: </span>
                    <a
                      href='https://cloud.siliconflow.cn/i/hij0YNTZ'
                      target='_blank'
                      rel='noopener noreferrer'
                      className='ml-1 underline text-ui-brand'
                    >
                      https://cloud.siliconflow.cn/i/hij0YNTZ
                    </a>
                  </Notice>
                )}

                {inputs.type === 3 && (
                  <div className='space-y-3'>
                    <Notice kind='warning'>
                      {t('2025年5月10日后添加的渠道，不需要再在部署的时候移除模型名称中的"."')}
                    </Notice>
                    <FieldRow label='AZURE_OPENAI_ENDPOINT'>
                      <TextField
                        value={inputs.base_url || ''}
                        onChange={(v) => handleInputChange('base_url', v)}
                        placeholder={t('请输入 AZURE_OPENAI_ENDPOINT，例如：https://docs-test-001.openai.azure.com')}
                        disabled={isIonetLocked}
                      />
                    </FieldRow>
                    <FieldRow label={t('默认 API 版本')}>
                      <TextField value={inputs.other || ''} onChange={(v) => handleInputChange('other', v)} placeholder={t('请输入默认 API 版本，例如：2025-04-01-preview')} />
                    </FieldRow>
                    <FieldRow label={t('默认 Responses API 版本，为空则使用上方版本')}>
                      <TextField
                        value={inputs.azure_responses_version || ''}
                        onChange={(v) => handleChannelOtherSettingsChange('azure_responses_version', v)}
                        placeholder={t('例如：preview')}
                      />
                    </FieldRow>
                  </div>
                )}

                {inputs.type === 8 && (
                  <div className='space-y-3'>
                    <Notice kind='warning'>
                      {t('如果你对接的是上游One API或者New API等转发项目，请使用OpenAI类型，不要使用此类型，除非你知道你在做什么。')}
                    </Notice>
                    <FieldRow label={t('完整的 Base URL，支持变量{model}')}>
                      <TextField
                        value={inputs.base_url || ''}
                        onChange={(v) => handleInputChange('base_url', v)}
                        placeholder={t('请输入完整的URL，例如：https://api.openai.com/v1/chat/completions')}
                        disabled={isIonetLocked}
                      />
                    </FieldRow>
                  </div>
                )}

                {inputs.type === 37 && (
                  <Notice kind='warning'>
                    {t('Dify渠道只适配chatflow和agent，并且agent不支持图片！')}
                  </Notice>
                )}

                {inputs.type !== 3 &&
                  inputs.type !== 8 &&
                  inputs.type !== 22 &&
                  inputs.type !== 36 &&
                  (inputs.type !== 45 || doubaoApiEditUnlocked) && (
                    <FieldRow
                      label={t('API地址')}
                      hint={t('对于官方渠道，new-api已经内置地址，除非是第三方代理站点或者Azure的特殊接入地址，否则不需要填写')}
                    >
                      <TextField
                        value={inputs.base_url || ''}
                        onChange={(v) => handleInputChange('base_url', v)}
                        placeholder={t('此项可选，用于通过自定义API地址来进行 API 调用，末尾不要带/v1和/')}
                        disabled={isIonetLocked}
                      />
                    </FieldRow>
                  )}

                {inputs.type === 22 && (
                  <FieldRow label={t('私有部署地址')}>
                    <TextField
                      value={inputs.base_url || ''}
                      onChange={(v) => handleInputChange('base_url', v)}
                      placeholder={t('请输入私有部署地址，格式为：https://fastgpt.run/api/openapi')}
                      disabled={isIonetLocked}
                    />
                  </FieldRow>
                )}

                {inputs.type === 36 && (
                  <FieldRow label={t('注意非Chat API，请务必填写正确的API地址，否则可能导致无法使用')}>
                    <TextField
                      value={inputs.base_url || ''}
                      onChange={(v) => handleInputChange('base_url', v)}
                      placeholder={t('请输入到 /suno 前的路径，通常就是域名，例如：https://api.example.com')}
                      disabled={isIonetLocked}
                    />
                  </FieldRow>
                )}

                {inputs.type === 45 && !doubaoApiEditUnlocked && (
                  <FieldRow label={t('API地址')}>
                    <NativeSelect
                      value={inputs.base_url || 'https://ark.cn-beijing.volces.com'}
                      onChange={(v) => handleInputChange('base_url', v)}
                      disabled={isIonetLocked}
                      options={[
                        { value: 'https://ark.cn-beijing.volces.com', label: 'https://ark.cn-beijing.volces.com' },
                        { value: 'https://ark.ap-southeast.bytepluses.com', label: 'https://ark.ap-southeast.bytepluses.com' },
                        ...(canKeepDeprecatedDoubaoCodingPlan ? [
                          { value: DEPRECATED_DOUBAO_CODING_PLAN_BASE_URL, label: 'Doubao Coding Plan' }
                        ] : []),
                      ]}
                    />
                  </FieldRow>
                )}
              </div>

              {/* Models multi-select */}
              <FieldRow
                label={t('模型')}
                required
                extra={
                  <div className='flex flex-wrap items-center gap-1'>
                    {MODEL_FETCHABLE_CHANNEL_TYPES.has(inputs.type) && (
                      <Button size='sm' variant='ghost' onClick={() => fetchUpstreamModelList('models')}>
                        {t('获取模型列表')}
                      </Button>
                    )}
                    <Button size='sm' variant='ghost' onClick={() => handleInputChange('models', fullModels)}>
                      {t('填入所有模型')}
                    </Button>
                    <Button
                      size='sm'
                      variant='ghost'
                      onClick={() => {
                        if (inputs.models.length === 0) { showInfo(t('没有模型可以复制')); return; }
                        try { copy(inputs.models.join(',')); showSuccess(t('模型列表已复制到剪贴板')); } catch { showError(t('复制失败')); }
                      }}
                    >
                      {t('复制所有模型')}
                    </Button>
                    <Button size='sm' variant='danger' onClick={() => handleInputChange('models', [])}>
                      {t('清除所有模型')}
                    </Button>
                  </div>
                }
              >
                <MultiCombobox
                  value={inputs.models}
                  onChange={(v) => handleInputChange('models', v)}
                  options={(modelOptions || []).map((o) => ({
                    value: o.value,
                    label: o.value,
                  }))}
                  placeholder={t('请选择该渠道所支持的模型')}
                  searchPlaceholder={t('搜索模型…')}
                  allowCreate
                />
                {modelGroups && modelGroups.length > 0 && (
                  <div className='flex flex-wrap items-center gap-1 mt-2'>
                    <span className='text-[11px] text-ui-text-3 mr-1'>{t('快速添加分组')}:</span>
                    {modelGroups.map((group) => (
                      <Button
                        key={group.name}
                        size='sm'
                        variant='ghost'
                        onClick={() => {
                          let items = [];
                          try {
                            if (Array.isArray(group.items)) items = group.items;
                            else if (typeof group.items === 'string') {
                              const parsed = JSON.parse(group.items || '[]');
                              if (Array.isArray(parsed)) items = parsed;
                            }
                          } catch {}
                          const merged = Array.from(
                            new Set([...inputs.models, ...items].map((m) => (m || '').trim()).filter(Boolean)),
                          );
                          handleInputChange('models', merged);
                        }}
                      >
                        {group.name}
                      </Button>
                    ))}
                  </div>
                )}
              </FieldRow>

              {/* Custom model name */}
              <FieldRow label={t('自定义模型名称')}>
                <div className='flex items-center gap-1.5'>
                  <TextField
                    value={customModel}
                    onChange={(v) => setCustomModel(v.trim())}
                    placeholder={t('输入自定义模型名称')}
                  />
                  <Button onClick={addCustomModels}>
                    {t('填入')}
                  </Button>
                </div>
              </FieldRow>

              {/* Groups */}
              <FieldRow label={t('分组')}>
                <MultiCombobox
                  value={inputs.groups}
                  onChange={(v) => handleInputChange('groups', v)}
                  options={(groupOptions || []).map((o) => ({
                    value: typeof o === 'object' ? o.value : o,
                    label: typeof o === 'object' ? o.label : o,
                  }))}
                  placeholder={t('请选择可以使用该渠道的分组')}
                  allowCreate
                />
              </FieldRow>

              {/* Model mapping */}
              <JSONEditor
                key={`model_mapping-${isEdit ? channelId : 'new'}`}
                field='model_mapping'
                label={t('模型重定向')}
                placeholder={
                  t('此项可选，用于修改请求体中的模型名称，为一个 JSON 字符串，键为请求中模型名称，值为要替换的模型名称，例如：') +
                  `\n${JSON.stringify(MODEL_MAPPING_EXAMPLE, null, 2)}`
                }
                value={inputs.model_mapping || ''}
                onChange={(v) => handleInputChange('model_mapping', v)}
                template={MODEL_MAPPING_EXAMPLE}
                templateLabel={t('填入模板')}
                editorType='keyValue'
                formApi={formApiRef.current}
                renderStringValueSuffix={({ pairKey, value }) => {
                  if (!MODEL_FETCHABLE_CHANNEL_TYPES.has(inputs.type)) return null;
                  const disabled = !String(pairKey ?? '').trim();
                  return (
                    <button
                      title={t('选择模型')}
                      disabled={disabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        openModelMappingValueModal({ pairKey, value });
                      }}
                      className='p-1 rounded text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-subtle disabled:opacity-40'
                    >
                      <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><circle cx='11' cy='11' r='8'/><path d='m21 21-4.3-4.3'/></svg>
                    </button>
                  );
                }}
                extraText={t('键为请求中的模型名称，值为要替换的模型名称')}
              />

              {/* Auto ban */}
              <ToggleField
                label={t('是否自动禁用')}
                hint={t('仅当自动禁用开启时有效，关闭后不会自动禁用该渠道')}
                checked={autoBan}
                onChange={(v) => {
                  setAutoBan(v);
                  handleInputChange('auto_ban', v ? 1 : 0);
                }}
              />
            </Section>

            {/* Advanced settings — collapsible */}
            <button
              onClick={() => toggleAdvancedSettings(!advancedSettingsOpen)}
              className='flex items-center justify-between w-full px-3 py-2.5 rounded-xl border border-ui-border bg-ui-bg-subtle text-ui-text-2 hover:text-ui-text hover:bg-ui-bg transition-colors'
            >
              <span className='text-sm font-medium'>{t('高级设置')}</span>
              <span className='text-xs flex items-center gap-1'>
                {advancedSettingsOpen ? t('收起') : t('展开')}
              </span>
            </button>

            {advancedSettingsOpen && (
              <div className='space-y-5'>
                {/* Upstream model management */}
                {MODEL_FETCHABLE_CHANNEL_TYPES.has(inputs.type) && (
                  <Section title={t('上游模型管理')}>
                    <ToggleField
                      label={t('是否检测上游模型更新')}
                      hint={t('开启后由后端定时任务检测该渠道上游模型变化')}
                      checked={!!inputs.upstream_model_update_check_enabled}
                      onChange={(v) => handleChannelOtherSettingsChange('upstream_model_update_check_enabled', v)}
                    />
                    <ToggleField
                      label={t('是否自动同步上游模型更新')}
                      hint={t('开启后检测到新增模型会自动加入当前渠道模型列表')}
                      checked={!!inputs.upstream_model_update_auto_sync_enabled}
                      disabled={!inputs.upstream_model_update_check_enabled}
                      onChange={(v) => handleChannelOtherSettingsChange('upstream_model_update_auto_sync_enabled', v)}
                    />
                    <FieldRow
                      label={t('已忽略模型')}
                      hint={t('支持精确匹配；使用 regex: 开头可按正则匹配。')}
                    >
                      <TextField
                        value={inputs.upstream_model_update_ignored_models || ''}
                        onChange={(v) => handleInputChange('upstream_model_update_ignored_models', v)}
                        placeholder={t('例如：gpt-4.1-nano,regex:^claude-.*$,regex:^sora-.*$')}
                      />
                    </FieldRow>
                    <div className='text-[11px] text-ui-text-3'>
                      {t('上次检测时间')}: {formatUnixTime(inputs.upstream_model_update_last_check_time)}
                    </div>
                    <div className='text-[11px] text-ui-text-3 break-all'>
                      {t('上次检测到可加入模型')}:{' '}
                      {upstreamDetectedModels.length === 0
                        ? t('暂无')
                        : upstreamDetectedModelsPreview.join(', ') +
                          (upstreamDetectedModelsOmittedCount > 0
                            ? ` (${t('共 {{total}} 个，省略 {{omit}} 个', {
                                total: upstreamDetectedModels.length,
                                omit: upstreamDetectedModelsOmittedCount,
                              })})`
                            : ` (${t('共 {{total}} 个', { total: upstreamDetectedModels.length })})`)}
                    </div>
                  </Section>
                )}

                {/* Request config */}
                <Section title={t('请求配置')}>
                  {/* Param override */}
                  <FieldRow
                    label={t('参数覆盖')}
                    hint={t('此项可选，用于覆盖请求参数。不支持覆盖 stream 参数')}
                    extra={
                      <div className='flex items-center gap-1'>
                        <Button size='sm' onClick={() => setParamOverrideEditorVisible(true)}>
                          {t('可视化编辑')}
                        </Button>
                        <Button size='sm' variant='ghost' onClick={() => applyParamOverrideTemplate('operations', 'fill')}>
                          {t('填充新模板')}
                        </Button>
                        <Button size='sm' variant='ghost' onClick={() => applyParamOverrideTemplate('legacy', 'fill')}>
                          {t('填充旧模板')}
                        </Button>
                        <Button size='sm' variant='danger' onClick={clearParamOverride}>
                          {t('清空')}
                        </Button>
                      </div>
                    }
                  >
                    <div className='rounded-md p-3 border border-ui-border bg-ui-bg-subtle'>
                      <div className='flex items-center justify-between mb-2'>
                        <Chip>{paramOverrideMeta.tagLabel}</Chip>
                        <Button size='sm' variant='secondary' onClick={copyParamOverrideJson}>
                          {t('复制')}
                        </Button>
                      </div>
                      <pre className='m-0 text-[11px] leading-5 whitespace-pre-wrap break-all max-h-56 overflow-auto text-ui-text-2 font-mono'>
                        {paramOverrideMeta.preview}
                      </pre>
                    </div>
                  </FieldRow>

                  {/* Header override */}
                  <FieldRow
                    label={t('请求头覆盖')}
                    hint={t('支持变量：渠道密钥 {api_key}')}
                    extra={
                      <div className='flex items-center gap-1'>
                        <Button
                          size='sm'
                          variant='ghost'
                          onClick={() =>
                            handleInputChange(
                              'header_override',
                              JSON.stringify({ '*': true, 're:^X-Trace-.*$': true, 'X-Foo': '{client_header:X-Foo}', Authorization: 'Bearer {api_key}', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0' }, null, 2),
                            )
                          }
                        >
                          {t('填入模板')}
                        </Button>
                        <Button
                          size='sm'
                          variant='ghost'
                          onClick={() =>
                            handleInputChange('header_override', JSON.stringify({ '*': true }, null, 2))
                          }
                        >
                          {t('填入透传模版')}
                        </Button>
                        <Button size='sm' variant='ghost' onClick={() => formatJsonField('header_override')}>
                          {t('格式化')}
                        </Button>
                      </div>
                    }
                  >
                    <TextAreaField
                      value={inputs.header_override || ''}
                      onChange={(v) => handleInputChange('header_override', v)}
                      placeholder={
                        t('此项可选，用于覆盖请求头参数') +
                        '\n' +
                        t('格式示例：') +
                        '\n{\n  "User-Agent": "Mozilla/5.0 ...",\n  "Authorization": "Bearer {api_key}"\n}'
                      }
                      rows={4}
                    />
                  </FieldRow>

                  {/* Status code mapping */}
                  <JSONEditor
                    key={`status_code_mapping-${isEdit ? channelId : 'new'}`}
                    field='status_code_mapping'
                    label={t('状态码复写')}
                    placeholder={
                      t('此项可选，用于复写返回的状态码，仅影响本地判断，不修改返回到上游的状态码，比如将claude渠道的400错误复写为500（用于重试），请勿滥用该功能，例如：') +
                      '\n' +
                      JSON.stringify(STATUS_CODE_MAPPING_EXAMPLE, null, 2)
                    }
                    value={inputs.status_code_mapping || ''}
                    onChange={(v) => handleInputChange('status_code_mapping', v)}
                    template={STATUS_CODE_MAPPING_EXAMPLE}
                    templateLabel={t('填入模板')}
                    editorType='keyValue'
                    formApi={formApiRef.current}
                    extraText={t('键为原状态码，值为要复写的状态码，仅影响本地判断')}
                  />
                </Section>

                {/* Channel behavior */}
                <Section title={t('渠道行为')}>
                  <FieldRow label={t('渠道标签')}>
                    <TextField
                      value={inputs.tag || ''}
                      onChange={(v) => handleInputChange('tag', v)}
                      placeholder={t('渠道标签')}
                    />
                  </FieldRow>
                  <FieldRow label={t('备注')}>
                    <TextAreaField
                      value={inputs.remark || ''}
                      onChange={(v) => handleInputChange('remark', v)}
                      placeholder={t('请输入备注（仅管理员可见）')}
                      maxLength={255}
                      rows={3}
                    />
                  </FieldRow>
                  <div className='grid grid-cols-2 gap-3'>
                    <FieldRow label={t('渠道优先级')}>
                      <NumberField
                        value={inputs.priority || 0}
                        onChange={(v) => handleInputChange('priority', v)}
                        min={0}
                      />
                    </FieldRow>
                    <FieldRow label={t('渠道权重')}>
                      <NumberField
                        value={inputs.weight || 0}
                        onChange={(v) => handleInputChange('weight', v)}
                        min={0}
                      />
                    </FieldRow>
                  </div>

                  {/* Field passthrough — OpenAI */}
                  {inputs.type === 1 && (
                    <div className='space-y-1.5 pt-2 border-t border-ui-border'>
                      <div className='text-[11px] uppercase tracking-wider text-ui-text-3 font-semibold mb-1'>
                        {t('字段透传控制')}
                      </div>
                      <ToggleField
                        label={t('允许 service_tier 透传')}
                        hint={t('service_tier 字段用于指定服务层级，允许透传可能导致实际计费高于预期。默认关闭以避免额外费用')}
                        checked={!!inputs.allow_service_tier}
                        onChange={(v) => handleChannelOtherSettingsChange('allow_service_tier', v)}
                      />
                      <ToggleField
                        label={t('禁用 store 透传')}
                        hint={t('store 字段用于授权 OpenAI 存储请求数据以评估和优化产品。默认关闭，开启后可能导致 Codex 无法正常使用')}
                        checked={!!inputs.disable_store}
                        onChange={(v) => handleChannelOtherSettingsChange('disable_store', v)}
                      />
                      <ToggleField
                        label={t('允许 safety_identifier 透传')}
                        hint={t('safety_identifier 字段用于帮助 OpenAI 识别可能违反使用政策的应用程序用户。默认关闭以保护用户隐私')}
                        checked={!!inputs.allow_safety_identifier}
                        onChange={(v) => handleChannelOtherSettingsChange('allow_safety_identifier', v)}
                      />
                      <ToggleField
                        label={t('允许 stream_options.include_obfuscation 透传')}
                        hint={t('include_obfuscation 用于控制 Responses 流混淆字段。默认关闭以避免客户端关闭该安全保护')}
                        checked={!!inputs.allow_include_obfuscation}
                        onChange={(v) => handleChannelOtherSettingsChange('allow_include_obfuscation', v)}
                      />
                    </div>
                  )}

                  {/* Field passthrough — Anthropic */}
                  {inputs.type === 14 && (
                    <div className='space-y-1.5 pt-2 border-t border-ui-border'>
                      <div className='text-[11px] uppercase tracking-wider text-ui-text-3 font-semibold mb-1'>
                        {t('字段透传控制')}
                      </div>
                      <ToggleField
                        label={t('允许 service_tier 透传')}
                        hint={t('service_tier 字段用于指定服务层级，允许透传可能导致实际计费高于预期。默认关闭以避免额外费用')}
                        checked={!!inputs.allow_service_tier}
                        onChange={(v) => handleChannelOtherSettingsChange('allow_service_tier', v)}
                      />
                      <ToggleField
                        label={t('允许 inference_geo 透传')}
                        hint={t('inference_geo 字段用于控制 Claude 数据驻留推理区域。默认关闭以避免未经授权透传地域信息')}
                        checked={!!inputs.allow_inference_geo}
                        onChange={(v) => handleChannelOtherSettingsChange('allow_inference_geo', v)}
                      />
                      <ToggleField
                        label={t('允许 speed 透传')}
                        hint={t('speed 字段用于控制 Claude 推理速度模式。默认关闭以避免意外切换到 fast 模式')}
                        checked={!!inputs.allow_speed}
                        onChange={(v) => handleChannelOtherSettingsChange('allow_speed', v)}
                      />
                    </div>
                  )}
                </Section>

                {/* Extra settings */}
                <Section title={t('额外设置')}>
                  {inputs.type === 14 && (
                    <ToggleField
                      label={t('Claude 强制 beta=true')}
                      hint={t('开启后，该渠道请求 Claude 时将强制追加 ?beta=true（无需客户端手动传参）')}
                      checked={!!inputs.claude_beta_query}
                      onChange={(v) => handleChannelOtherSettingsChange('claude_beta_query', v)}
                    />
                  )}
                  {inputs.type === 1 && (
                    <ToggleField
                      label={t('强制格式化')}
                      hint={t('强制将响应格式化为 OpenAI 标准格式（只适用于OpenAI渠道类型）')}
                      checked={!!inputs.force_format}
                      onChange={(v) => handleChannelSettingsChange('force_format', v)}
                    />
                  )}
                  <ToggleField
                    label={t('思考内容转换')}
                    hint={t('将 reasoning_content 转换为 <think> 标签拼接到内容中')}
                    checked={!!inputs.thinking_to_content}
                    onChange={(v) => handleChannelSettingsChange('thinking_to_content', v)}
                  />
                  <ToggleField
                    label={t('透传请求体')}
                    hint={t('启用请求体透传功能')}
                    checked={!!inputs.pass_through_body_enabled}
                    onChange={(v) => handleChannelSettingsChange('pass_through_body_enabled', v)}
                  />
                  <FieldRow label={t('代理地址')} hint={t('用于配置网络代理，支持 socks5 协议')}>
                    <TextField
                      value={inputs.proxy || ''}
                      onChange={(v) => handleChannelSettingsChange('proxy', v)}
                      placeholder={t('例如: socks5://user:pass@host:port')}
                    />
                  </FieldRow>
                  <FieldRow
                    label={t('系统提示词')}
                    hint={t('用户优先：如果用户在请求中指定了系统提示词，将优先使用用户的设置')}
                  >
                    <TextAreaField
                      value={inputs.system_prompt || ''}
                      onChange={(v) => handleChannelSettingsChange('system_prompt', v)}
                      placeholder={t('输入系统提示词，用户的系统提示词将优先于此设置')}
                      rows={3}
                    />
                  </FieldRow>
                  <ToggleField
                    label={t('系统提示词拼接')}
                    hint={t('如果用户请求中包含系统提示词，则使用此设置拼接到用户的系统提示词前面')}
                    checked={!!inputs.system_prompt_override}
                    onChange={(v) => handleChannelSettingsChange('system_prompt_override', v)}
                  />
                </Section>
              </div>
            )}
          </div>
        )}
        {modalImageUrl && isModalOpenurl &&
          createPortal(
            <div
              className='fixed inset-0 z-[140] flex items-center justify-center p-4 cursor-zoom-out'
              style={{ background: 'rgba(0,0,0,0.85)' }}
              onClick={() => setIsModalOpenurl(false)}
            >
              <img
                src={modalImageUrl}
                alt=''
                className='max-w-[92vw] max-h-[90vh] rounded-md'
                onClick={(e) => e.stopPropagation()}
              />
            </div>,
            document.body,
          )}
      </SlideOver>
      <StatusCodeRiskGuardModal
        visible={statusCodeRiskConfirmVisible}
        detailItems={statusCodeRiskDetailItems}
        onCancel={() => resolveStatusCodeRiskConfirm(false)}
        onConfirm={() => resolveStatusCodeRiskConfirm(true)}
      />
      {/* 使用通用安全验证模态框 */}
      <SecureVerificationModal
        visible={isModalVisible}
        verificationMethods={verificationMethods}
        verificationState={verificationState}
        onVerify={executeVerification}
        onCancel={cancelVerification}
        onCodeChange={setVerificationCode}
        onMethodSwitch={switchVerificationMethod}
        title={verificationState.title}
        description={verificationState.description}
      />

      {/* 使用ChannelKeyDisplay组件显示密钥 */}
      {keyDisplayState.showModal &&
        createPortal(
          <div
            className='fixed inset-0 z-[130] flex items-center justify-center p-4'
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}
            onClick={resetKeyDisplayState}
          >
            <div
              className='border border-ui-border rounded-[20px] shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden'
              style={{ backgroundColor: 'var(--page-bg)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className='flex items-center justify-between gap-3 px-6 py-4 border-b border-ui-border'>
                <span
                  className='text-base font-semibold text-ui-text'
                  style={{ letterSpacing: '-0.02em' }}
                >{t('渠道密钥信息')}</span>
                <IconButton icon={XIcon} size='sm' onClick={resetKeyDisplayState} />
              </div>
              <div className='flex-1 overflow-y-auto p-5'>
                <ChannelKeyDisplay
                  keyData={keyDisplayState.keyData}
                  showSuccessIcon={true}
                  successText={t('密钥获取成功')}
                  showWarning={true}
                  warningText={t('请妥善保管密钥信息，不要泄露给他人。如有安全疑虑，请及时更换密钥。')}
                />
              </div>
              <div className='flex justify-end gap-2 px-6 py-4 border-t border-ui-border'>
                <Button onClick={resetKeyDisplayState}>
                  {t('完成')}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* 缺失模型映射 3-按钮确认弹窗 */}
      {missingModelsModal.visible &&
        createPortal(
          <div
            className='fixed inset-0 z-[125] flex items-center justify-center p-4'
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}
            onClick={() => closeMissingModelsModal('cancel')}
          >
            <div
              className='border border-ui-border rounded-[20px] shadow-2xl w-full max-w-md overflow-hidden'
              style={{ backgroundColor: 'var(--page-bg)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className='px-6 py-5'>
                <h3
                  className='flex items-center gap-2 text-base font-semibold text-ui-text mb-2'
                  style={{ letterSpacing: '-0.02em' }}
                >
                  <AlertTriangle size={15} className='text-amber-500' />
                  {t('模型未加入列表，可能无法调用')}
                </h3>
                <div className='text-sm text-ui-text-2 leading-relaxed'>
                  {t('模型重定向里的下列模型尚未添加到“模型”列表，调用时会因为缺少可用模型而失败：')}
                </div>
                <div className='font-mono text-xs break-all text-ui-danger mt-2 px-3 py-2 rounded-lg bg-ui-danger-bg'>
                  {missingModelsModal.models.join(', ')}
                </div>
                <div className='mt-3 text-sm text-ui-text-2'>
                  {t('你可以在"自定义模型名称"处手动添加它们，然后点击填入后再提交，或者直接使用下方操作自动处理。')}
                </div>
              </div>
              <div className='flex justify-end gap-2 px-6 py-4 border-t border-ui-border'>
                <Button variant='secondary' onClick={() => closeMissingModelsModal('cancel')}>
                  {t('返回修改')}
                </Button>
                <Button variant='secondary' onClick={() => closeMissingModelsModal('submit')}>
                  {t('直接提交')}
                </Button>
                <Button onClick={() => closeMissingModelsModal('add')}>
                  {t('添加后提交')}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <ParamOverrideEditorModal
        visible={paramOverrideEditorVisible}
        value={inputs.param_override || ''}
        onCancel={() => setParamOverrideEditorVisible(false)}
        onSave={(nextValue) => {
          handleInputChange('param_override', nextValue);
          setParamOverrideEditorVisible(false);
        }}
      />

      <ModelSelectModal
        visible={modelModalVisible}
        models={fetchedModels}
        selected={inputs.models}
        redirectModels={redirectModelList}
        onConfirm={(selectedModels) => {
          handleInputChange('models', selectedModels);
          showSuccess(t('模型列表已更新'));
          setModelModalVisible(false);
        }}
        onCancel={() => setModelModalVisible(false)}
      />

      <SingleModelSelectModal
        visible={modelMappingValueModalVisible}
        models={modelMappingValueModalModels}
        selected={modelMappingValueSelected}
        onConfirm={(selectedModel) => {
          const modelName = String(selectedModel ?? '').trim();
          if (!modelName) {
            showError(t('请先选择模型！'));
            return;
          }

          const mappingKey = String(modelMappingValueKey ?? '').trim();
          if (!mappingKey) {
            setModelMappingValueModalVisible(false);
            return;
          }

          let parsed = {};
          const currentMapping = inputs.model_mapping;
          if (typeof currentMapping === 'string' && currentMapping.trim()) {
            try {
              parsed = JSON.parse(currentMapping);
            } catch (error) {
              parsed = {};
            }
          } else if (
            currentMapping &&
            typeof currentMapping === 'object' &&
            !Array.isArray(currentMapping)
          ) {
            parsed = currentMapping;
          }
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            parsed = {};
          }

          parsed[mappingKey] = modelName;
          const nextMapping = JSON.stringify(parsed, null, 2);
          handleInputChange('model_mapping', nextMapping);
          if (formApiRef.current) {
            formApiRef.current.setValue('model_mapping', nextMapping);
          }
          setModelMappingValueModalVisible(false);
        }}
        onCancel={() => setModelMappingValueModalVisible(false)}
      />
    </>
  );
};

export default EditChannelModal;

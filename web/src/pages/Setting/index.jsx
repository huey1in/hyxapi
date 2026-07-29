import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, Save, Plus, Trash2 } from 'lucide-react';
import { API, showError, showSuccess, isRoot } from '../../helpers';
import {
  PageShell, Button, IconButton, Input, NumberInput, Textarea, Switch, Tabs, Loading, EmptyState, Select, TagInput,
} from '../../components/ui';
import { Lock } from 'lucide-react';
import { orderSettingKeysForSave } from './saveOrder.js';

const TABS = [
  { key: 'platform',    label: '平台' },
  { key: 'global',      label: '全局' },
  { key: 'auth',        label: '认证' },
  { key: 'ssrf',        label: '安全' },
  { key: 'pricing',     label: '定价/分组' },
  { key: 'limits',      label: '限制' },
  { key: 'model',       label: '模型适配' },
  { key: 'affinity',    label: '渠道亲和' },
  { key: 'dashboard',   label: '仪表盘' },
  { key: 'performance', label: '性能' },
];

const TAB_KEYS = {
  platform: ['ServerAddress', 'RetryTimes', 'general_setting.quota_display_type', 'DisplayTokenStatEnabled', 'token_setting.max_user_tokens', 'EpayEnabled', 'PayAddress', 'EpayId', 'EpayKey', 'CustomCallbackAddress', 'Price', 'MinTopUp', 'TopUpPresetAmounts', 'PayMethods', 'AlipayEnabled', 'AlipayAppId', 'AlipayPrivateKey', 'AlipayPublicKey', 'AlipayGateway'],
  global: [
    'global.pass_through_request_enabled',
    'global.thinking_model_blacklist',
    'global.chat_completions_to_responses_policy',
    'general_setting.ping_interval_enabled', 'general_setting.ping_interval_seconds',
  ],
  auth: [
    'RegisterEnabled', 'PasswordRegisterEnabled', 'PasswordLoginEnabled',
    'EmailVerificationEnabled', 'EmailDomainRestrictionEnabled', 'EmailAliasRestrictionEnabled', 'EmailDomainWhitelist',
    'SMTPServer', 'SMTPPort', 'SMTPAccount', 'SMTPFrom', 'SMTPToken', 'SMTPSSLEnabled', 'SMTPForceAuthLogin',
    'EmailTemplateVerification', 'EmailTemplatePasswordReset',
    'GitHubOAuthEnabled', 'GitHubClientId', 'GitHubClientSecret',
    'LinuxDOOAuthEnabled', 'LinuxDOClientId', 'LinuxDOClientSecret', 'LinuxDOMinimumTrustLevel',
    'WeChatAuthEnabled', 'WeChatServerAddress', 'WeChatServerToken', 'WeChatAccountQRCodeImageURL',
    'TurnstileCheckEnabled', 'TurnstileSiteKey', 'TurnstileSecretKey',
    'TelegramOAuthEnabled', 'TelegramBotToken', 'TelegramBotName',
    'discord.enabled', 'discord.client_id', 'discord.client_secret',
    'oidc.enabled', 'oidc.client_id', 'oidc.client_secret', 'oidc.well_known',
    'oidc.authorization_endpoint', 'oidc.token_endpoint', 'oidc.user_info_endpoint',
    'passkey.enabled', 'passkey.rp_display_name', 'passkey.rp_id', 'passkey.origins',
    'passkey.allow_insecure_origin', 'passkey.user_verification', 'passkey.attachment_preference',
  ],
  ssrf: [
    'fetch_setting.enable_ssrf_protection', 'fetch_setting.allow_private_ip',
    'fetch_setting.apply_ip_filter_for_domain', 'fetch_setting.domain_filter_mode',
    'fetch_setting.domain_list', 'fetch_setting.ip_filter_mode',
    'fetch_setting.ip_list', 'fetch_setting.allowed_ports',
  ],
  pricing: ['ModelRatio', 'CompletionRatio', 'CacheRatio', 'CreateCacheRatio', 'ImageRatio', 'AudioRatio', 'AudioCompletionRatio', 'ModelPrice', 'GroupRatio', 'UserUsableGroups', 'ExposeRatioEnabled'],
  limits: [
    'ChannelDisableThreshold', 'AutomaticDisableChannelEnabled', 'AutomaticEnableChannelEnabled',
    'AutomaticDisableKeywords', 'AutomaticDisableStatusCodes', 'AutomaticRetryStatusCodes',
    'QuotaForNewUser', 'QuotaForInviter', 'QuotaForInvitee', 'PreConsumedQuota', 'QuotaRemindThreshold',
    'quota_setting.enable_free_model_pre_consume',
    'ModelRequestRateLimitEnabled', 'ModelRequestRateLimitCount', 'ModelRequestRateLimitDurationMinutes', 'ModelRequestRateLimitSuccessCount',
    'MultiKeyCooldownEnabled', 'MultiKeyCooldownThreshold', 'MultiKeyCooldownWindowMinutes', 'MultiKeyCooldownDurationMinutes',
    'CheckSensitiveEnabled', 'CheckSensitiveOnPromptEnabled', 'StopOnSensitiveEnabled', 'SensitiveWords',
  ],
  model: [
    'claude.thinking_adapter_enabled', 'claude.thinking_adapter_budget_tokens_percentage',
    'claude.model_headers_settings', 'claude.default_max_tokens',
    'gemini.thinking_adapter_enabled', 'gemini.thinking_adapter_budget_tokens_percentage',
    'gemini.safety_settings', 'gemini.version_settings', 'gemini.supported_imagine_models',
    'gemini.function_call_thought_signature_enabled', 'gemini.remove_function_response_id_enabled',
    'grok.violation_deduction_enabled', 'grok.violation_deduction_amount',
  ],
  affinity: [
    'channel_affinity_setting.enabled', 'channel_affinity_setting.switch_on_success',
    'channel_affinity_setting.max_entries', 'channel_affinity_setting.default_ttl_seconds',
    'channel_affinity_setting.rules',
  ],
  dashboard: ['DataExportEnabled', 'DataExportInterval', 'DataExportDefaultTime', 'LogConsumeEnabled',
    'monitor_setting.auto_test_channel_enabled', 'monitor_setting.auto_test_channel_minutes',
    'monitor_setting.model_health_enabled', 'monitor_setting.model_health_interval_minutes',
    'console_setting.announcements_enabled', 'console_setting.announcements',
    'log_setting.log_request_body', 'log_setting.log_response_body', 'log_setting.max_body_log_bytes',
  ],
  performance: ['StreamCacheQueueLength', 'BatchUpdateEnabled', 'BatchUpdateInterval', 'MemoryCacheEnabled', 'CacheKeyPrefix',
    'performance_setting.disk_cache_enabled', 'performance_setting.disk_cache_threshold_mb',
    'performance_setting.disk_cache_max_size_mb', 'performance_setting.disk_cache_path',
    'performance_setting.monitor_enabled', 'performance_setting.monitor_cpu_threshold',
    'performance_setting.monitor_memory_threshold', 'performance_setting.monitor_disk_threshold',
  ],
};

const TAB_SECTIONS = {
  platform: [
    { title: '基本信息', keys: ['ServerAddress'] },
    { title: '功能开关', keys: ['RetryTimes', 'general_setting.quota_display_type', 'DisplayTokenStatEnabled', 'token_setting.max_user_tokens'] },
    { title: '易支付 (Epay)', gateKey: 'EpayEnabled', keys: ['EpayEnabled', 'PayAddress', 'EpayId', 'EpayKey', 'CustomCallbackAddress', 'Price', 'MinTopUp', 'TopUpPresetAmounts', 'PayMethods'] },
    { title: '支付宝电脑网站支付', gateKey: 'AlipayEnabled', keys: ['AlipayEnabled', 'AlipayAppId', 'AlipayPrivateKey', 'AlipayPublicKey', 'AlipayGateway'] },
  ],
  auth: [
    { title: '注册与登录', keys: ['RegisterEnabled', 'PasswordRegisterEnabled', 'PasswordLoginEnabled'] },
    { title: '邮箱验证', keys: ['EmailVerificationEnabled', 'EmailDomainRestrictionEnabled', 'EmailAliasRestrictionEnabled', 'EmailDomainWhitelist', 'SMTPServer', 'SMTPPort', 'SMTPAccount', 'SMTPFrom', 'SMTPToken', 'SMTPSSLEnabled', 'SMTPForceAuthLogin', 'EmailTemplateVerification', 'EmailTemplatePasswordReset'] },
    { title: 'OAuth 登录', keys: ['GitHubOAuthEnabled', 'GitHubClientId', 'GitHubClientSecret', 'LinuxDOOAuthEnabled', 'LinuxDOClientId', 'LinuxDOClientSecret', 'LinuxDOMinimumTrustLevel', 'discord.enabled', 'discord.client_id', 'discord.client_secret', 'oidc.enabled', 'oidc.client_id', 'oidc.client_secret', 'oidc.well_known', 'oidc.authorization_endpoint', 'oidc.token_endpoint', 'oidc.user_info_endpoint', 'WeChatAuthEnabled', 'WeChatServerAddress', 'WeChatServerToken', 'WeChatAccountQRCodeImageURL', 'TelegramOAuthEnabled', 'TelegramBotToken', 'TelegramBotName', 'TurnstileCheckEnabled', 'TurnstileSiteKey', 'TurnstileSecretKey'] },
    { title: 'Passkey', keys: ['passkey.enabled', 'passkey.rp_display_name', 'passkey.rp_id', 'passkey.origins', 'passkey.allow_insecure_origin', 'passkey.user_verification', 'passkey.attachment_preference'] },
  ],
  limits: [
    { title: '渠道管理', keys: ['ChannelDisableThreshold', 'AutomaticDisableChannelEnabled', 'AutomaticEnableChannelEnabled', 'AutomaticDisableKeywords', 'AutomaticDisableStatusCodes', 'AutomaticRetryStatusCodes'] },
    { title: '额度', keys: ['QuotaForNewUser', 'QuotaForInviter', 'QuotaForInvitee', 'PreConsumedQuota', 'QuotaRemindThreshold', 'quota_setting.enable_free_model_pre_consume'] },
    { title: '请求限速', keys: ['ModelRequestRateLimitEnabled', 'ModelRequestRateLimitCount', 'ModelRequestRateLimitDurationMinutes', 'ModelRequestRateLimitSuccessCount'] },
    { title: '多 Key 冷却', gateKey: 'MultiKeyCooldownEnabled', keys: ['MultiKeyCooldownEnabled', 'MultiKeyCooldownThreshold', 'MultiKeyCooldownWindowMinutes', 'MultiKeyCooldownDurationMinutes'] },
    { title: '敏感词', keys: ['CheckSensitiveEnabled', 'CheckSensitiveOnPromptEnabled', 'StopOnSensitiveEnabled', 'SensitiveWords'] },
  ],
  model: [
    { title: 'Claude', keys: ['claude.thinking_adapter_enabled', 'claude.thinking_adapter_budget_tokens_percentage', 'claude.model_headers_settings', 'claude.default_max_tokens'] },
    { title: 'Gemini', keys: ['gemini.thinking_adapter_enabled', 'gemini.thinking_adapter_budget_tokens_percentage', 'gemini.safety_settings', 'gemini.version_settings', 'gemini.supported_imagine_models', 'gemini.function_call_thought_signature_enabled', 'gemini.remove_function_response_id_enabled'] },
    { title: 'Grok', keys: ['grok.violation_deduction_enabled', 'grok.violation_deduction_amount'] },
  ],
  dashboard: [
    { title: '数据看板', keys: ['DataExportEnabled', 'DataExportInterval', 'DataExportDefaultTime', 'LogConsumeEnabled'] },
    { title: '渠道监控', keys: ['monitor_setting.auto_test_channel_enabled', 'monitor_setting.auto_test_channel_minutes'] },
    { title: '模型健康检测', keys: ['monitor_setting.model_health_enabled', 'monitor_setting.model_health_interval_minutes'] },
    { title: '前台展示', keys: ['console_setting.announcements_enabled', 'console_setting.announcements'] },
    { title: '日志内容记录', gateKey: 'log_setting.log_request_body', keys: ['log_setting.log_request_body', 'log_setting.log_response_body', 'log_setting.max_body_log_bytes'] },
  ],
  pricing: [
    { title: '模型倍率', component: 'CombinedRatioEditor', keys: ['ModelRatio', 'CompletionRatio', 'CacheRatio', 'CreateCacheRatio', 'ImageRatio', 'AudioRatio', 'AudioCompletionRatio'] },
    { title: '模型定价', keys: ['ModelPrice'] },
    { title: '分组', component: 'GroupRatioEditor', keys: ['GroupRatio', 'UserUsableGroups'] },
    { title: '其他', keys: ['ExposeRatioEnabled'] },
  ],
};

const WIDE_KEYS = new Set([...Array.from(new Set(['EmailDomainWhitelist', 'SensitiveWords', 'AutomaticDisableKeywords', 'AutomaticDisableStatusCodes', 'AutomaticRetryStatusCodes', 'fetch_setting.domain_list', 'fetch_setting.ip_list', 'fetch_setting.allowed_ports', 'global.thinking_model_blacklist', 'gemini.supported_imagine_models'])), 'ModelRatio', 'CompletionRatio', 'CacheRatio', 'CreateCacheRatio', 'ImageRatio', 'AudioRatio', 'AudioCompletionRatio', 'GroupRatio', 'ModelPrice', 'UserUsableGroups', 'claude.model_headers_settings', 'claude.default_max_tokens', 'gemini.safety_settings', 'gemini.version_settings', 'channel_affinity_setting.rules', 'console_setting.announcements', 'global.chat_completions_to_responses_policy', 'EmailTemplateVerification', 'EmailTemplatePasswordReset', 'AlipayPrivateKey', 'AlipayPublicKey']);

const MULTILINE_KEYS = new Set(['EmailTemplateVerification', 'EmailTemplatePasswordReset', 'AlipayPrivateKey', 'AlipayPublicKey']);
const TAG_KEYS = new Set(['EmailDomainWhitelist', 'SensitiveWords', 'AutomaticDisableKeywords', 'AutomaticDisableStatusCodes', 'AutomaticRetryStatusCodes', 'fetch_setting.domain_list', 'fetch_setting.ip_list', 'fetch_setting.allowed_ports', 'global.thinking_model_blacklist', 'gemini.supported_imagine_models']);
const JSON_ARRAY_TAG_KEYS = new Set(['fetch_setting.domain_list', 'fetch_setting.ip_list', 'fetch_setting.allowed_ports', 'global.thinking_model_blacklist', 'gemini.supported_imagine_models']);
const NEWLINE_TAG_KEYS = new Set(['SensitiveWords', 'AutomaticDisableKeywords']);
const JSON_KEYS = new Set(['ModelRatio', 'CompletionRatio', 'CacheRatio', 'CreateCacheRatio', 'ImageRatio', 'AudioRatio', 'AudioCompletionRatio', 'GroupRatio', 'ModelPrice', 'UserUsableGroups', 'claude.default_max_tokens', 'gemini.safety_settings', 'gemini.version_settings']);
const RAW_JSON_KEYS = new Set(['claude.model_headers_settings', 'channel_affinity_setting.rules']);
const POLICY_KEYS = new Set(['global.chat_completions_to_responses_policy']);
const LIST_EDITOR_KEYS = new Set(['console_setting.announcements', 'PayMethods']);
const BOOL_KEYS = new Set([
  'EmailVerificationEnabled', 'EmailDomainRestrictionEnabled', 'EmailAliasRestrictionEnabled',
  'SMTPSSLEnabled', 'SMTPForceAuthLogin',
  'GitHubOAuthEnabled', 'LinuxDOOAuthEnabled', 'WeChatAuthEnabled',
  'TelegramOAuthEnabled', 'TurnstileCheckEnabled',
  'RegisterEnabled', 'PasswordRegisterEnabled', 'PasswordLoginEnabled',
  'AutomaticDisableChannelEnabled', 'AutomaticEnableChannelEnabled',
  'DataExportEnabled', 'LogConsumeEnabled',
  'BatchUpdateEnabled', 'MemoryCacheEnabled',
  'ExposeRatioEnabled',
  'DisplayTokenStatEnabled',
  'passkey.enabled', 'passkey.allow_insecure_origin',
  'fetch_setting.enable_ssrf_protection', 'fetch_setting.allow_private_ip',
  'fetch_setting.apply_ip_filter_for_domain', 'fetch_setting.domain_filter_mode',
  'fetch_setting.ip_filter_mode',
  'global.pass_through_request_enabled',
  'general_setting.ping_interval_enabled',
  'discord.enabled', 'oidc.enabled',
  'claude.thinking_adapter_enabled',
  'gemini.thinking_adapter_enabled', 'gemini.function_call_thought_signature_enabled', 'gemini.remove_function_response_id_enabled',
  'grok.violation_deduction_enabled',
  'channel_affinity_setting.enabled', 'channel_affinity_setting.switch_on_success',
  'monitor_setting.auto_test_channel_enabled',
  'ModelRequestRateLimitEnabled', 'MultiKeyCooldownEnabled', 'CheckSensitiveEnabled', 'CheckSensitiveOnPromptEnabled', 'StopOnSensitiveEnabled',
  'quota_setting.enable_free_model_pre_consume',
  'performance_setting.disk_cache_enabled', 'performance_setting.monitor_enabled',
  'console_setting.announcements_enabled',
  'monitor_setting.model_health_enabled',
  'EpayEnabled',
  'AlipayEnabled',
  'log_setting.log_request_body', 'log_setting.log_response_body',
]);
const NUMBER_KEYS = new Set([
  'ChannelDisableThreshold',
  'QuotaForNewUser', 'QuotaForInviter', 'QuotaForInvitee', 'PreConsumedQuota', 'QuotaRemindThreshold',
  'DataExportInterval', 'StreamCacheQueueLength', 'BatchUpdateInterval',
  'SMTPPort', 'LinuxDOMinimumTrustLevel',
  'RetryTimes', 'token_setting.max_user_tokens',
  'general_setting.ping_interval_seconds',
  'claude.thinking_adapter_budget_tokens_percentage',
  'gemini.thinking_adapter_budget_tokens_percentage',
  'grok.violation_deduction_amount',
  'channel_affinity_setting.max_entries', 'channel_affinity_setting.default_ttl_seconds',
  'monitor_setting.auto_test_channel_minutes',
  'monitor_setting.model_health_interval_minutes',
  'ModelRequestRateLimitCount', 'ModelRequestRateLimitDurationMinutes', 'ModelRequestRateLimitSuccessCount',
  'MultiKeyCooldownThreshold', 'MultiKeyCooldownWindowMinutes', 'MultiKeyCooldownDurationMinutes',
  'performance_setting.disk_cache_threshold_mb', 'performance_setting.disk_cache_max_size_mb',
  'performance_setting.monitor_cpu_threshold', 'performance_setting.monitor_memory_threshold', 'performance_setting.monitor_disk_threshold',
  'Price', 'MinTopUp',
  'log_setting.max_body_log_bytes',
]);

const LABELS = {
  ServerAddress: '服务器地址',
  EpayEnabled: '启用易支付',
  AlipayEnabled: '启用支付宝电脑网站支付',
  AlipayAppId: '支付宝应用 App ID',
  AlipayPrivateKey: '应用私钥（RSA2）',
  AlipayPublicKey: '支付宝公钥（RSA2）',
  AlipayGateway: '支付宝网关地址',
  PayAddress: '易支付网关地址 (PayAddress)',
  EpayId: '易支付商户 ID (PID)',
  EpayKey: '易支付商户密钥 (KEY)',
  CustomCallbackAddress: '自定义回调地址(留空用服务器地址)',
  Price: '易支付单价(每单位充值的人民币金额)',
  MinTopUp: '易支付最低充值数量',
  TopUpPresetAmounts: '充值预设金额选项（逗号分隔，如 1,20,100）',
  PayMethods: '易支付支付方式',
  RetryTimes: '失败重试次数',
  'general_setting.quota_display_type': '额度展示类型',
  DisplayTokenStatEnabled: '额度查询返回令牌额度而非用户额度',
  'token_setting.max_user_tokens': '用户最大令牌数量',
  EmailVerificationEnabled: '邮箱验证',
  EmailDomainRestrictionEnabled: '邮箱域名白名单',
  EmailAliasRestrictionEnabled: '邮箱别名限制',
  EmailDomainWhitelist: '允许的邮箱域名',
  SMTPServer: 'SMTP 服务器',
  SMTPPort: 'SMTP 端口',
  SMTPAccount: 'SMTP 账号',
  SMTPFrom: 'SMTP 发件人',
  SMTPToken: 'SMTP 密码/Token',
  SMTPSSLEnabled: 'SMTP SSL',
  SMTPForceAuthLogin: '强制 AUTH LOGIN',
  EmailTemplateVerification: '验证码邮件模板',
  EmailTemplatePasswordReset: '密码重置邮件模板',
  GitHubOAuthEnabled: 'GitHub 登录',
  GitHubClientId: 'GitHub Client ID',
  GitHubClientSecret: 'GitHub Client Secret',
  LinuxDOOAuthEnabled: 'LinuxDO 登录',
  LinuxDOClientId: 'LinuxDO Client ID',
  LinuxDOClientSecret: 'LinuxDO Client Secret',
  LinuxDOMinimumTrustLevel: 'LinuxDO 最低信任等级',
  WeChatAuthEnabled: '微信登录',
  WeChatServerAddress: '微信服务器地址',
  WeChatServerToken: '微信服务器 Token',
  WeChatAccountQRCodeImageURL: '微信二维码图片地址',
  TurnstileCheckEnabled: 'Turnstile 验证',
  TurnstileSiteKey: 'Turnstile Site Key',
  TurnstileSecretKey: 'Turnstile Secret Key',
  TelegramOAuthEnabled: 'Telegram 登录',
  TelegramBotToken: 'Telegram Bot Token',
  TelegramBotName: 'Telegram Bot 名称',
  'passkey.enabled': 'Passkey 登录',
  'passkey.rp_display_name': '服务显示名称',
  'passkey.rp_id': '网站域名标识',
  'passkey.origins': '允许的 Origins',
  'passkey.allow_insecure_origin': '允许 HTTP Origin',
  'passkey.user_verification': '安全验证级别',
  'passkey.attachment_preference': '设备类型偏好',
  'fetch_setting.enable_ssrf_protection': '启用 SSRF 防护',
  'fetch_setting.allow_private_ip': '允许访问私有 IP',
  'fetch_setting.apply_ip_filter_for_domain': '对域名启用 IP 过滤',
  'fetch_setting.domain_filter_mode': '域名白名单模式',
  'fetch_setting.domain_list': '域名列表',
  'fetch_setting.ip_filter_mode': 'IP 白名单模式',
  'fetch_setting.ip_list': 'IP 列表',
  'fetch_setting.allowed_ports': '允许的端口',
  RegisterEnabled: '允许注册',
  PasswordRegisterEnabled: '密码注册',
  PasswordLoginEnabled: '密码登录',
  ModelRatio: '模型倍率',
  CompletionRatio: '模型补全倍率',
  CacheRatio: '缓存提示倍率',
  CreateCacheRatio: '缓存创建倍率',
  ImageRatio: '图片输入倍率',
  AudioRatio: '音频输入倍率',
  AudioCompletionRatio: '音频补全倍率',
  GroupRatio: '分组倍率',
  ModelPrice: '模型定价',
  UserUsableGroups: '用户可选分组',
  ExposeRatioEnabled: '暴露倍率接口',
  ChannelDisableThreshold: '渠道禁用阈值',
  AutomaticDisableChannelEnabled: '自动禁用异常渠道',
  AutomaticEnableChannelEnabled: '自动启用恢复渠道',
  QuotaForNewUser: '新用户初始额度',
  QuotaForInviter: '邀请人奖励额度',
  QuotaForInvitee: '被邀请人奖励额度',
  PreConsumedQuota: '预扣费额度',
  QuotaRemindThreshold: '额度提醒阈值',
  DataExportEnabled: '数据看板',
  DataExportInterval: '数据导出间隔(分钟)',
  DataExportDefaultTime: '默认时间范围',
  LogConsumeEnabled: '记录消费日志',
  StreamCacheQueueLength: '流缓存队列长度',
  BatchUpdateEnabled: '批量更新',
  BatchUpdateInterval: '批量更新间隔(秒)',
  MemoryCacheEnabled: '内存缓存',
  CacheKeyPrefix: '缓存 Key 前缀',
  // 全局
  'global.pass_through_request_enabled': '启用请求透传',
  'global.thinking_model_blacklist': '禁用思考处理的模型列表',
  'global.chat_completions_to_responses_policy': 'ChatCompletions → Responses 兼容配置',
  'general_setting.ping_interval_enabled': '启用 Ping 保活',
  'general_setting.ping_interval_seconds': 'Ping 间隔（秒）',
  // 认证 - Discord / OIDC
  'discord.enabled': 'Discord 登录',
  'discord.client_id': 'Discord Client ID',
  'discord.client_secret': 'Discord Client Secret',
  'oidc.enabled': 'OIDC 登录',
  'oidc.client_id': 'OIDC Client ID',
  'oidc.client_secret': 'OIDC Client Secret',
  'oidc.well_known': 'OIDC Well-Known URL',
  'oidc.authorization_endpoint': 'OIDC 授权端点',
  'oidc.token_endpoint': 'OIDC Token 端点',
  'oidc.user_info_endpoint': 'OIDC UserInfo 端点',
  // 限制
  AutomaticDisableKeywords: '自动禁用关键词',
  AutomaticDisableStatusCodes: '自动禁用状态码',
  AutomaticRetryStatusCodes: '自动重试状态码',
  ModelRequestRateLimitEnabled: '模型请求限速',
  ModelRequestRateLimitCount: '限速请求数',
  ModelRequestRateLimitDurationMinutes: '限速时间窗口（分钟）',
  ModelRequestRateLimitSuccessCount: '限速成功请求数',
  MultiKeyCooldownEnabled: '多 Key 单 Key 自动冷却',
  MultiKeyCooldownThreshold: '冷却触发失败次数',
  MultiKeyCooldownWindowMinutes: '失败统计窗口（分钟）',
  MultiKeyCooldownDurationMinutes: '冷却时长（分钟）',
  CheckSensitiveEnabled: '敏感词检测',
  CheckSensitiveOnPromptEnabled: '对提示词检测敏感词',
  StopOnSensitiveEnabled: '检测到敏感词时停止',
  SensitiveWords: '敏感词列表',
  'quota_setting.enable_free_model_pre_consume': '免费模型预扣费',
  // 模型适配 - Claude
  'claude.thinking_adapter_enabled': '启用 Claude 思考适配',
  'claude.thinking_adapter_budget_tokens_percentage': 'Claude 思考预算百分比',
  'claude.model_headers_settings': 'Claude 请求头追加（JSON）',
  'claude.default_max_tokens': 'Claude 缺省 MaxTokens（JSON）',
  // 模型适配 - Gemini
  'gemini.thinking_adapter_enabled': '启用 Gemini 思考适配',
  'gemini.thinking_adapter_budget_tokens_percentage': 'Gemini 思考预算占比',
  'gemini.safety_settings': 'Gemini 安全设置（JSON）',
  'gemini.version_settings': 'Gemini 版本设置（JSON）',
  'gemini.supported_imagine_models': '支持的图像模型',
  'gemini.function_call_thought_signature_enabled': '启用 FunctionCall 思维签名填充',
  'gemini.remove_function_response_id_enabled': '移除 functionResponse.id 字段',
  // 模型适配 - Grok
  'grok.violation_deduction_enabled': '启用违规扣费',
  'grok.violation_deduction_amount': '违规扣费金额',
  // 渠道亲和
  'channel_affinity_setting.enabled': '启用渠道亲和性',
  'channel_affinity_setting.switch_on_success': '成功后切换亲和',
  'channel_affinity_setting.max_entries': '最大条目数',
  'channel_affinity_setting.default_ttl_seconds': '默认 TTL（秒）',
  'channel_affinity_setting.rules': '亲和规则（JSON）',
  // 仪表盘
  'monitor_setting.auto_test_channel_enabled': '自动测试渠道',
  'monitor_setting.auto_test_channel_minutes': '自动测试间隔（分钟）',
  'console_setting.announcements_enabled': '启用系统公告',
  'console_setting.announcements': '系统公告',
  'monitor_setting.model_health_enabled': '启用模型健康检测',
  'monitor_setting.model_health_interval_minutes': '检测间隔（分钟）',
  // 性能
  'performance_setting.disk_cache_enabled': '磁盘缓存',
  'performance_setting.disk_cache_threshold_mb': '磁盘缓存阈值（MB）',
  'performance_setting.disk_cache_max_size_mb': '磁盘缓存最大容量（MB）',
  'performance_setting.disk_cache_path': '磁盘缓存路径',
  'performance_setting.monitor_enabled': '性能监控',
  'performance_setting.monitor_cpu_threshold': 'CPU 告警阈值（%）',
  'performance_setting.monitor_memory_threshold': '内存告警阈值（%）',
  'performance_setting.monitor_disk_threshold': '磁盘告警阈值（%）',
  // 日志内容记录
  'log_setting.log_request_body': '记录请求内容',
  'log_setting.log_response_body': '记录响应内容',
  'log_setting.max_body_log_bytes': '内容截断字节数',
};

const SELECT_OPTIONS = {
  'general_setting.quota_display_type': [
    { value: 'USD', label: 'USD ($)' },
    { value: 'CNY', label: 'CNY (¥)' },
    { value: 'TOKENS', label: 'Tokens' },
  ],
  'passkey.user_verification': [
    { value: 'preferred', label: '优先验证' },
    { value: 'required', label: '强制验证' },
    { value: 'discouraged', label: '跳过验证' },
  ],
  'passkey.attachment_preference': [
    { value: '', label: '无偏好' },
    { value: 'platform', label: 'platform（内置设备）' },
    { value: 'cross-platform', label: 'cross-platform（外部设备）' },
  ],
};

const toBool = (v) => v === true || v === 'true' || v === '1';

const parseJsonMap = (value) => {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const mapKeys = (value) => new Set(Object.keys(parseJsonMap(value)));

const RatioEditor = ({ value, onChange, suggestions = [], configuredModels = new Set(), numericValue = true }) => {
  const lastEmittedRef = useRef(null);
  const [pairs, setPairs] = useState(() => {
    try {
      const obj = JSON.parse(value || '{}');
      return Object.entries(obj).map(([k, v]) => ({ key: k, value: String(v) }));
    } catch { return []; }
  });

  useEffect(() => {
    if ((value || '{}') === lastEmittedRef.current) return;
    try {
      const obj = JSON.parse(value || '{}');
      const incoming = Object.entries(obj).map(([k, v]) => ({ key: k, value: String(v) }));
      const current = pairs.filter((p) => p.key.trim());
      const currentJson = JSON.stringify(current.map((p) => [p.key, p.value]));
      const incomingJson = JSON.stringify(incoming.map((p) => [p.key, p.value]));
      if (currentJson !== incomingJson) setPairs(incoming);
    } catch {}
  }, [value]);

  const sync = (newPairs) => {
    setPairs(newPairs);
    const obj = {};
    newPairs.forEach(({ key, value: v }) => {
      if (key.trim()) obj[key.trim()] = numericValue ? (isNaN(Number(v)) ? v : Number(v)) : v;
    });
    const nextValue = JSON.stringify(obj, null, 2);
    lastEmittedRef.current = nextValue;
    onChange(nextValue);
  };

  const update = (idx, field, v) => {
    const next = [...pairs];
    next[idx] = { ...next[idx], [field]: v };
    sync(next);
  };
  const add = () => sync([...pairs, { key: '', value: numericValue ? '1' : '' }]);
  const remove = (idx) => sync(pairs.filter((_, i) => i !== idx));
  const addModel = (name) => sync([...pairs, { key: name, value: numericValue ? '1' : name }]);

  const unsetModels = suggestions.filter((s) => !configuredModels.has(s) && !pairs.some((p) => p.key === s));

  return (
    <div className='space-y-2'>
      {unsetModels.length > 0 && (
        <div style={{ padding: '8px 10px', background: '#FFF8E8', borderRadius: 10, border: '1px solid #f0e6d0' }}>
          <div className='text-xs text-[#999] mb-1.5'>未设置 ({unsetModels.length})</div>
          <div className='flex flex-wrap gap-1'>
            {unsetModels.map((m) => (
              <button key={m} type='button' onClick={() => addModel(m)} style={{ height: 24, paddingInline: 8, borderRadius: 12, border: '1px solid var(--ui-border)', background: 'var(--page-bg)', fontSize: 11, color: 'var(--ui-text-2)', cursor: 'pointer' }} title='点击添加'>
                + {m}
              </button>
            ))}
          </div>
        </div>
      )}
      {pairs.map((p, i) => (
        <div key={i} className='flex items-center gap-2' style={{ minWidth: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Input value={p.key} onChange={(v) => update(i, 'key', v)} placeholder='名称' width='100%' />
          </div>
          <div style={{ width: 100, flexShrink: 0 }}>
            <Input value={p.value} onChange={(v) => update(i, 'value', v)} placeholder={numericValue ? '倍率' : '描述'} width='100%' />
          </div>
          <button type='button' onClick={() => remove(i)} style={{ flexShrink: 0, padding: 6, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ui-text-3)' }} title='删除'>
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <div className='flex items-center gap-2'>
        <Button size='sm' variant='toggle' icon={Plus} onClick={add}>添加</Button>
      </div>
      <div className='text-xs text-[#999]'>{pairs.length} 项</div>
    </div>
  );
};

const RATIO_COLUMNS = [
  { key: 'model',       jsonKey: 'ModelRatio',       label: '输入' },
  { key: 'completion',   jsonKey: 'CompletionRatio',  label: '输出' },
  { key: 'cache',        jsonKey: 'CacheRatio',       label: '缓存读' },
  { key: 'cacheCreate',  jsonKey: 'CreateCacheRatio', label: '缓存写' },
  { key: 'image',        jsonKey: 'ImageRatio',       label: '图片' },
  { key: 'audio',        jsonKey: 'AudioRatio',       label: '音频入' },
  { key: 'audioCompletion', jsonKey: 'AudioCompletionRatio', label: '音频出' },
];

const CombinedRatioEditor = ({ values, onChange, suggestions = [], configuredModels = new Set() }) => {
  // values: { ModelRatio: '{...}', CompletionRatio: '{...}', ... }
  // onChange: (jsonKey, newJsonStr) => void

  const lastEmittedRef = useRef(null);

  const parseMap = (jsonKey) => parseJsonMap(values[jsonKey]);

  const snapshotValues = (source) => JSON.stringify(RATIO_COLUMNS.map((col) => [col.jsonKey, source[col.jsonKey] || '{}']));

  // Build merged rows: { modelName: { model: 1.5, completion: 5, ... } }
  const buildRows = () => {
    const allModels = new Set();
    const maps = {};
    RATIO_COLUMNS.forEach((col) => {
      maps[col.key] = parseMap(col.jsonKey);
      Object.keys(maps[col.key]).forEach((m) => allModels.add(m));
    });
    const rows = [];
    allModels.forEach((m) => {
      const row = { name: m };
      RATIO_COLUMNS.forEach((col) => {
        if (maps[col.key][m] !== undefined) row[col.key] = String(maps[col.key][m]);
      });
      rows.push(row);
    });
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  };

  const [rows, setRows] = useState(buildRows);

  useEffect(() => {
    if (snapshotValues(values) === lastEmittedRef.current) return;
    setRows(buildRows());
  }, [values.ModelRatio, values.CompletionRatio, values.CacheRatio, values.CreateCacheRatio, values.ImageRatio, values.AudioRatio, values.AudioCompletionRatio]);

  // Determine which columns are visible (have at least one value)
  const visibleCols = RATIO_COLUMNS.filter((col) =>
    col.key === 'model' || col.key === 'completion' || rows.some((r) => r[col.key] !== undefined)
  );

  const syncToJson = (newRows) => {
    setRows(newRows);
    const nextValues = {};
    RATIO_COLUMNS.forEach((col) => {
      const obj = {};
      newRows.forEach((r) => {
        if (r.name.trim() && r[col.key] !== undefined && r[col.key] !== '') {
          const n = Number(r[col.key]);
          obj[r.name.trim()] = isNaN(n) ? r[col.key] : n;
        }
      });
      nextValues[col.jsonKey] = JSON.stringify(obj, null, 2);
    });
    lastEmittedRef.current = snapshotValues(nextValues);
    RATIO_COLUMNS.forEach((col) => {
      onChange(col.jsonKey, nextValues[col.jsonKey]);
    });
  };

  const updateCell = (idx, colKey, v) => {
    const next = [...rows];
    next[idx] = { ...next[idx], [colKey]: v };
    syncToJson(next);
  };

  const updateName = (idx, v) => {
    const next = [...rows];
    next[idx] = { ...next[idx], name: v };
    syncToJson(next);
  };

  const toggleCell = (idx, colKey) => {
    const next = [...rows];
    if (next[idx][colKey] !== undefined) {
      const { [colKey]: _, ...rest } = next[idx];
      next[idx] = rest;
    } else {
      next[idx] = { ...next[idx], [colKey]: '1' };
    }
    syncToJson(next);
  };

  const addRow = () => syncToJson([...rows, { name: '', model: '1', completion: '1' }]);
  const addModel = (m) => syncToJson([...rows, { name: m, model: '1', completion: '1' }]);
  const removeRow = (idx) => syncToJson(rows.filter((_, i) => i !== idx));

  const unsetModels = suggestions.filter((s) => !configuredModels.has(s) && !rows.some((r) => r.name === s));

  return (
    <div className='space-y-3'>
      {unsetModels.length > 0 && (
        <div style={{ padding: '8px 10px', background: '#FFF8E8', borderRadius: 10, border: '1px solid #f0e6d0' }}>
          <div className='text-xs text-[#999] mb-1.5'>未设置 ({unsetModels.length})</div>
          <div className='flex flex-wrap gap-1'>
            {unsetModels.map((m) => (
              <button key={m} type='button' onClick={() => addModel(m)} style={{ height: 24, paddingInline: 8, borderRadius: 12, border: '1px solid var(--ui-border)', background: 'var(--page-bg)', fontSize: 11, color: 'var(--ui-text-2)', cursor: 'pointer' }} title='点击添加'>
                + {m}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div className='flex items-center gap-2' style={{ minWidth: 0, paddingRight: 32 }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: '#999', paddingLeft: 2 }}>模型</div>
        {visibleCols.map((col) => (
          <div key={col.key} style={{ width: 70, flexShrink: 0, fontSize: 12, color: '#999', textAlign: 'center' }}>{col.label}</div>
        ))}
      </div>

      {/* Rows */}
      {rows.map((r, i) => (
        <div key={i} className='flex items-center gap-2' style={{ minWidth: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Input value={r.name} onChange={(v) => updateName(i, v)} placeholder='模型名' width='100%' />
          </div>
          {visibleCols.map((col) => (
            <div key={col.key} style={{ width: 70, flexShrink: 0 }}>
              {r[col.key] !== undefined ? (
                <Input value={r[col.key]} onChange={(v) => updateCell(i, col.key, v)} placeholder='—' width='100%' />
              ) : (
                <button type='button' onClick={() => toggleCell(i, col.key)} style={{ width: '100%', height: 32, borderRadius: 8, border: '1px dashed var(--ui-border)', background: 'transparent', cursor: 'pointer', color: '#ccc', fontSize: 12 }} title='点击启用'>
                  —
                </button>
              )}
            </div>
          ))}
          <button type='button' onClick={() => removeRow(i)} style={{ flexShrink: 0, padding: 6, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ui-text-3)' }} title='删除'>
            <Trash2 size={15} />
          </button>
        </div>
      ))}

      <div className='flex items-center gap-2'>
        <Button size='sm' variant='toggle' icon={Plus} onClick={addRow}>添加</Button>
        <span className='text-xs text-[#999]'>{rows.length} 个模型</span>
      </div>
    </div>
  );
};

const GroupRatioEditor = ({ values, onChange, suggestions = [] }) => {
  // values: { GroupRatio: '{...}', UserUsableGroups: '{...}' }
  // onChange: (jsonKey, newJsonStr) => void

  const parseMap = (k) => { try { return JSON.parse(values[k] || '{}'); } catch { return {}; } };

  const buildRows = () => {
    const ratioMap = parseMap('GroupRatio');
    const usableMap = parseMap('UserUsableGroups');
    const allGroups = new Set([...Object.keys(ratioMap), ...Object.keys(usableMap)]);
    const rows = [];
    allGroups.forEach((g) => {
      rows.push({
        name: g,
        ratio: ratioMap[g] !== undefined ? String(ratioMap[g]) : '1',
        desc: usableMap[g] || '',
        usable: usableMap[g] !== undefined,
      });
    });
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  };

  const [rows, setRows] = useState(buildRows);

  useEffect(() => {
    setRows(buildRows());
  }, [values.GroupRatio, values.UserUsableGroups]);

  const syncToJson = (newRows) => {
    setRows(newRows);
    const ratioObj = {};
    const usableObj = {};
    newRows.forEach((r) => {
      if (!r.name.trim()) return;
      const n = Number(r.ratio);
      ratioObj[r.name.trim()] = isNaN(n) ? 1 : n;
      if (r.usable) usableObj[r.name.trim()] = r.desc || r.name.trim();
    });
    onChange('GroupRatio', JSON.stringify(ratioObj, null, 2));
    onChange('UserUsableGroups', JSON.stringify(usableObj, null, 2));
  };

  const updateField = (idx, field, v) => {
    const next = [...rows];
    next[idx] = { ...next[idx], [field]: v };
    syncToJson(next);
  };

  const toggleUsable = (idx) => {
    const next = [...rows];
    next[idx] = { ...next[idx], usable: !next[idx].usable };
    if (next[idx].usable && !next[idx].desc) next[idx].desc = next[idx].name;
    syncToJson(next);
  };

  const addRow = () => syncToJson([...rows, { name: '', ratio: '1', desc: '', usable: false }]);
  const addGroup = (g) => syncToJson([...rows, { name: g, ratio: '1', desc: g, usable: false }]);
  const removeRow = (idx) => syncToJson(rows.filter((_, i) => i !== idx));

  const unsetGroups = suggestions.filter((s) => !rows.some((r) => r.name === s));

  return (
    <div className='space-y-3'>
      {unsetGroups.length > 0 && (
        <div style={{ padding: '8px 10px', background: '#FFF8E8', borderRadius: 10, border: '1px solid #f0e6d0' }}>
          <div className='text-xs text-[#999] mb-1.5'>未设置 ({unsetGroups.length})</div>
          <div className='flex flex-wrap gap-1'>
            {unsetGroups.map((g) => (
              <button key={g} type='button' onClick={() => addGroup(g)} style={{ height: 24, paddingInline: 8, borderRadius: 12, border: '1px solid var(--ui-border)', background: 'var(--page-bg)', fontSize: 11, color: 'var(--ui-text-2)', cursor: 'pointer' }} title='点击添加'>
                + {g}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div className='flex items-center gap-2' style={{ minWidth: 0, paddingRight: 32 }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: '#999', paddingLeft: 2 }}>分组名</div>
        <div style={{ width: 80, flexShrink: 0, fontSize: 12, color: '#999', textAlign: 'center' }}>倍率</div>
        <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: '#999', paddingLeft: 2 }}>描述</div>
        <div style={{ width: 60, flexShrink: 0, fontSize: 12, color: '#999', textAlign: 'center' }}>用户可选</div>
      </div>

      {/* Rows */}
      {rows.map((r, i) => (
        <div key={i} className='flex items-center gap-2' style={{ minWidth: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Input value={r.name} onChange={(v) => updateField(i, 'name', v)} placeholder='分组名' width='100%' />
          </div>
          <div style={{ width: 80, flexShrink: 0 }}>
            <Input value={r.ratio} onChange={(v) => updateField(i, 'ratio', v)} placeholder='1' width='100%' />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Input value={r.desc} onChange={(v) => updateField(i, 'desc', v)} placeholder='描述（可选）' width='100%' disabled={!r.usable} />
          </div>
          <div style={{ width: 60, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
            <Switch checked={r.usable} onChange={() => toggleUsable(i)} />
          </div>
          <button type='button' onClick={() => removeRow(i)} style={{ flexShrink: 0, padding: 6, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ui-text-3)' }} title='删除'>
            <Trash2 size={15} />
          </button>
        </div>
      ))}

      <div className='flex items-center gap-2'>
        <Button size='sm' variant='toggle' icon={Plus} onClick={addRow}>添加</Button>
        <span className='text-xs text-[#999]'>{rows.length} 个分组</span>
      </div>
    </div>
  );
};

const PolicyEditor = ({ value, onChange }) => {
  const [obj, setObj] = useState(() => { try { return JSON.parse(value || '{}'); } catch { return {}; } });
  useEffect(() => { try { const p = JSON.parse(value || '{}'); setObj(p); } catch {} }, [value]);
  const update = (k, v) => { const next = { ...obj, [k]: v }; setObj(next); onChange(JSON.stringify(next)); };
  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between'>
        <span className='text-xs text-[#666]'>启用</span>
        <Switch checked={!!obj.enabled} onChange={(v) => update('enabled', v)} />
      </div>
      <div className='flex items-center justify-between'>
        <span className='text-xs text-[#666]'>全部渠道</span>
        <Switch checked={obj.all_channels !== false} onChange={(v) => update('all_channels', v)} />
      </div>
    </div>
  );
};

const AffinityRulesEditor = ({ value, onChange }) => {
  const [rules, setRules] = useState(() => { try { return JSON.parse(value || '[]'); } catch { return []; } });
  useEffect(() => { try { const r = JSON.parse(value || '[]'); setRules(r); } catch {} }, [value]);
  const sync = (next) => { setRules(next); onChange(JSON.stringify(next)); };
  const update = (idx, field, v) => { const next = [...rules]; next[idx] = { ...next[idx], [field]: v }; sync(next); };
  const remove = (idx) => sync(rules.filter((_, i) => i !== idx));
  const add = () => sync([...rules, { name: '', model_regex: [], key_sources: [{ type: 'gjson', path: '' }], ttl_seconds: 0 }]);
  return (
    <div className='space-y-3'>
      {rules.map((r, i) => (
        <div key={i} style={{ padding: '12px 14px', border: '1px solid var(--ui-border)', borderRadius: 12 }} className='space-y-2'>
          <div className='flex items-center gap-2'>
            <Input value={r.name || ''} onChange={(v) => update(i, 'name', v)} placeholder='规则名称' width='100%' />
            <button type='button' onClick={() => remove(i)} style={{ flexShrink: 0, padding: 6, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ui-text-3)' }}>
              <Trash2 size={15} />
            </button>
          </div>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
            <div style={{ minWidth: 0 }}>
              <div className='text-xs text-[#999] mb-1'>模型正则</div>
              <TagInput value={r.model_regex || []} onChange={(v) => update(i, 'model_regex', v)} placeholder='正则表达式' />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className='text-xs text-[#999] mb-1'>Key 来源</div>
              <Input value={(r.key_sources || []).map((s) => s.type === 'gjson' ? `gjson:${s.path}` : `${s.type}:${s.key || s.path}`).join(', ')} onChange={(v) => {
                const sources = v.split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
                  const [type, ...rest] = s.split(':');
                  const path = rest.join(':');
                  return type === 'gjson' ? { type: 'gjson', path } : { type, key: path };
                });
                update(i, 'key_sources', sources);
              }} placeholder='gjson:path' width='100%' />
            </div>
          </div>
          <div className='grid grid-cols-2 md:grid-cols-3 gap-2' style={{ minWidth: 0 }}>
            <div style={{ minWidth: 0 }}>
              <div className='text-xs text-[#999] mb-1'>TTL（秒）</div>
              <NumberInput value={r.ttl_seconds || 0} onChange={(v) => update(i, 'ttl_seconds', v)} />
            </div>
            <div>
              <div className='text-xs text-[#999] mb-1'>包含分组</div>
              <div className='pt-1'><Switch checked={!!r.include_using_group} onChange={(v) => update(i, 'include_using_group', v)} /></div>
            </div>
            <div>
              <div className='text-xs text-[#999] mb-1'>失败跳过重试</div>
              <div className='pt-1'><Switch checked={!!r.skip_retry_on_failure} onChange={(v) => update(i, 'skip_retry_on_failure', v)} /></div>
            </div>
          </div>
        </div>
      ))}
      <Button size='sm' variant='toggle' icon={Plus} onClick={add}>新增规则</Button>
    </div>
  );
};

const LIST_EDITOR_FIELDS = {
  'console_setting.announcements': [
    { key: 'content', label: '内容', flex: 3 },
    { key: 'type', label: '类型', type: 'select', options: [{ value: 'default', label: '默认' }, { value: 'ongoing', label: '进行中' }, { value: 'success', label: '成功' }, { value: 'warning', label: '警告' }, { value: 'error', label: '错误' }] },
    { key: 'extra', label: '说明' },
  ],
  PayMethods: [
    { key: 'name', label: '名称', flex: 2 },
    { key: 'type', label: '类型', flex: 2 },
    { key: 'color', label: '颜色' },
    { key: 'min_topup', label: '最低充值' },
  ],
};

const ListEditor = ({ configKey, value, onChange }) => {
  const [items, setItems] = useState(() => { try { return JSON.parse(value || '[]'); } catch { return []; } });
  useEffect(() => { try { const r = JSON.parse(value || '[]'); setItems(r); } catch {} }, [value]);
  const fields = LIST_EDITOR_FIELDS[configKey] || [];
  const sync = (next) => { setItems(next); onChange(JSON.stringify(next)); };
  const update = (idx, field, v) => { const next = [...items]; next[idx] = { ...next[idx], [field]: v }; sync(next); };
  const remove = (idx) => sync(items.filter((_, i) => i !== idx));
  const add = () => {
    const empty = {};
    fields.forEach((f) => { empty[f.key] = f.type === 'select' && f.options?.length ? f.options[0].value : ''; });
    if (configKey === 'console_setting.announcements') empty.publishDate = new Date().toISOString();
    sync([...items, empty]);
  };

  return (
    <div className='space-y-2'>
      {items.map((item, i) => (
        <div key={i} style={{ padding: '10px 12px', border: '1px solid var(--ui-border)', borderRadius: 10 }} className='space-y-2'>
          <div className='flex items-start gap-2' style={{ minWidth: 0 }}>
            {fields.map((f) => (
              <div key={f.key} style={{ flex: f.flex || 1, minWidth: 0 }}>
                <div className='text-xs text-[#999] mb-1'>{f.label}</div>
                {f.type === 'select'
                  ? <Select value={item[f.key] || f.options[0].value} options={f.options} onChange={(v) => update(i, f.key, v)} size={32} />
                  : <Input value={item[f.key] || ''} onChange={(v) => update(i, f.key, v)} width='100%' />}
              </div>
            ))}
            <button type='button' onClick={() => remove(i)} style={{ flexShrink: 0, marginTop: 18, padding: 6, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ui-text-3)' }}>
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      ))}
      <div className='flex items-center gap-3'>
        <Button size='sm' variant='toggle' icon={Plus} onClick={add}>添加</Button>
        <span className='text-xs text-[#999]'>{items.length} 项</span>
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
  const [modelList, setModelList] = useState([]);
  const [groupList, setGroupList] = useState([]);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  const sendTestEmail = async () => {
    if (!testEmail) { showError('请输入收件邮箱'); return; }
    setSendingTest(true);
    try {
      const { data } = await API.post('/api/option/test_email', { email: testEmail });
      if (data.success) showSuccess(data.message || '测试邮件已发送');
      else showError(data.message);
    } catch (e) { showError(e); } finally { setSendingTest(false); }
  };

  const loadModels = async () => {
    try {
      const { data } = await API.get('/api/channel/models_enabled');
      if (data.success) setModelList(data.data || []);
    } catch {}
  };
  const loadGroups = async () => {
    try {
      const { data } = await API.get('/api/group/');
      if (data.success) setGroupList(data.data || []);
    } catch {}
  };

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
  useEffect(() => { if (root) { load(); loadModels(); loadGroups(); } else setLoading(false); }, []);

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
    const keys = orderSettingKeysForSave(Object.keys(dirty));
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
  const sections = TAB_SECTIONS[active];

  const renderField = (k) => {
    if (BOOL_KEYS.has(k)) {
      return (
        <div key={k} className='flex items-center justify-between' style={{ gridColumn: '1 / -1' }}>
          <span style={{ fontSize: 14, color: 'var(--ui-text)' }}>{LABELS[k] || k}</span>
          <Switch checked={toBool(val(k))} onChange={(v) => set(k, v ? 'true' : 'false')} />
        </div>
      );
    }
    const wide = WIDE_KEYS.has(k) || TAG_KEYS.has(k) || JSON_KEYS.has(k) || RAW_JSON_KEYS.has(k) || POLICY_KEYS.has(k) || LIST_EDITOR_KEYS.has(k);
    return (
      <div key={k} style={wide ? { gridColumn: '1 / -1' } : undefined}>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 5 }}>{LABELS[k] || k}</label>
        {SELECT_OPTIONS[k]
          ? <Select value={val(k) || SELECT_OPTIONS[k][0].value} options={SELECT_OPTIONS[k]} onChange={(v) => set(k, v)} />
          : NUMBER_KEYS.has(k)
            ? <NumberInput value={Number(val(k)) || 0} onChange={(v) => set(k, String(v ?? 0))} />
            : JSON_KEYS.has(k)
              ? <RatioEditor
                  value={val(k)}
                  onChange={(v) => set(k, v)}
                  suggestions={k === 'GroupRatio' || k === 'UserUsableGroups' ? groupList : (k.startsWith('claude.') || k.startsWith('gemini.') ? [] : modelList)}
                  configuredModels={k === 'ModelPrice' ? mapKeys(val('ModelRatio')) : new Set()}
                  numericValue={k !== 'UserUsableGroups' && k !== 'gemini.safety_settings' && k !== 'gemini.version_settings'}
                />
              : RAW_JSON_KEYS.has(k)
                ? (k === 'channel_affinity_setting.rules'
                  ? <AffinityRulesEditor value={val(k)} onChange={(v) => set(k, v)} />
                  : <RatioEditor value={val(k)} onChange={(v) => set(k, v)} suggestions={[]} numericValue={false} />)
                : POLICY_KEYS.has(k)
                  ? <PolicyEditor value={val(k)} onChange={(v) => set(k, v)} />
                  : LIST_EDITOR_KEYS.has(k)
                    ? <ListEditor configKey={k} value={val(k)} onChange={(v) => set(k, v)} />
                    : TAG_KEYS.has(k)
                      ? <TagInput
                          value={JSON_ARRAY_TAG_KEYS.has(k) ? (() => { try { return JSON.parse(val(k) || '[]'); } catch { return []; } })() : (val(k) || '').split(NEWLINE_TAG_KEYS.has(k) ? '\n' : ',').filter(Boolean)}
                          onChange={(arr) => set(k, JSON_ARRAY_TAG_KEYS.has(k) ? JSON.stringify(arr) : arr.join(NEWLINE_TAG_KEYS.has(k) ? '\n' : ','))}
                        />
                      : MULTILINE_KEYS.has(k)
                        ? <><Textarea value={val(k)} onChange={(v) => set(k, v)} rows={6} placeholder={k === 'EmailTemplateVerification' ? '留空使用默认模板' : k === 'EmailTemplatePasswordReset' ? '留空使用默认模板' : ''} />
                            {k === 'EmailTemplateVerification' && <div style={{ marginTop: 4, fontSize: 11, color: '#999', lineHeight: 1.5 }}>可用变量：{'{{siteName}}'} 站点名称、{'{{code}}'} 验证码、{'{{expireMinutes}}'} 有效期（分钟）</div>}
                            {k === 'EmailTemplatePasswordReset' && <div style={{ marginTop: 4, fontSize: 11, color: '#999', lineHeight: 1.5 }}>可用变量：{'{{siteName}}'} 站点名称、{'{{resetLink}}'} 重置链接、{'{{expireMinutes}}'} 有效期（分钟）</div>}
                          </>
                        : <Input value={val(k)} onChange={(v) => set(k, v)} />}
      </div>
    );
  };

  const renderSection = (title, sectionKeys, sectionDef) => {
    // Special handling for CombinedRatioEditor
    if (sectionDef?.component === 'CombinedRatioEditor') {
      const ratioValues = {};
      sectionKeys.forEach((k) => { ratioValues[k] = val(k); });
      return (
        <div key={title} style={{ padding: '20px 22px', border: '1px solid var(--ui-border)', borderRadius: 26 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ui-text)', marginBottom: 16 }}>{title}</div>
          <CombinedRatioEditor
            values={ratioValues}
            onChange={(jsonKey, v) => set(jsonKey, v)}
            suggestions={modelList}
            configuredModels={mapKeys(val('ModelPrice'))}
          />
        </div>
      );
    }
    // Special handling for GroupRatioEditor
    if (sectionDef?.component === 'GroupRatioEditor') {
      const groupValues = {};
      sectionKeys.forEach((k) => { groupValues[k] = val(k); });
      return (
        <div key={title} style={{ padding: '20px 22px', border: '1px solid var(--ui-border)', borderRadius: 26 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ui-text)', marginBottom: 16 }}>{title}</div>
          <GroupRatioEditor
            values={groupValues}
            onChange={(jsonKey, v) => set(jsonKey, v)}
            suggestions={groupList}
          />
        </div>
      );
    }
    // Gated section: only show detailed config when the enable toggle is on
    const gateKey = sectionDef?.gateKey;
    const visibleKeys = gateKey && !toBool(val(gateKey))
      ? sectionKeys.filter((k) => k === gateKey)
      : sectionKeys;
    return (
      <div key={title} style={{ padding: '20px 22px', border: '1px solid var(--ui-border)', borderRadius: 26 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ui-text)', marginBottom: 16 }}>{title}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {visibleKeys.map(renderField)}
        </div>
        {title === '邮箱验证' && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--ui-border)' }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 6 }}>发送测试邮件</label>
            <div className='flex items-center gap-2'>
              <Input value={testEmail} onChange={setTestEmail} placeholder='输入测试收件邮箱' width={280} />
              <Button size='sm' loading={sendingTest} onClick={sendTestEmail}>发送测试邮件</Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%', maxWidth: 960, marginInline: 'auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--ui-text)' }}>系统设置</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <IconButton icon={RefreshCw} title='刷新' onClick={load} />
          <Button icon={Save} loading={saving} onClick={save} disabled={Object.keys(dirty).length === 0}>
            保存{Object.keys(dirty).length > 0 ? ` (${Object.keys(dirty).length})` : ''}
          </Button>
        </div>
      </div>

      <Tabs
        items={TABS.map((t) => ({ value: t.key, label: t.label }))}
        value={active}
        onChange={setActive}
      />

      {loading ? <Loading /> : (
        sections
          ? sections.map((s) => renderSection(s.title, s.keys, s))
          : renderSection(TABS.find((t) => t.key === active)?.label || active, keys)
      )}
    </div>
  );
};

export default SettingPage;

import type { ConfigShape } from '../../components/config/config-value';
import { CHANNEL_TYPE_OPTIONS } from '../../constants/channel-types';

const text: ConfigShape = { type: 'string' };
const number: ConfigShape = { type: 'number', min: 0 };
const ratio: ConfigShape = { ...number, initial: 1 };
const flag: ConfigShape = { type: 'boolean' };
const strings: ConfigShape = { type: 'array', entry: text };
const numbers: ConfigShape = { type: 'array', entry: number };
const map = (entry: ConfigShape, keyLabel = 'Name'): ConfigShape => ({ type: 'object', entry, keyLabel });
export const settingConfigShapes: Record<string, ConfigShape> = {
  'console_setting.announcements': {
    type: 'array', itemLabel: 'Announcement', entry: {
      type: 'object', createValue: () => ({ content: '', type: 'default', extra: '', publishDate: new Date().toISOString() }), fields: {
        content: { ...text, label: 'Content', multiline: true }, type: { ...text, label: 'Type' },
        extra: { ...text, label: 'Extra information' }, publishDate: { ...text, label: 'Publish date' },
      },
    },
  },
  PayMethods: {
    type: 'array', itemLabel: 'Payment method', entry: {
      type: 'object', initial: { name: '', type: '', color: '', min_topup: '' }, fields: {
        name: { ...text, label: 'Name' }, type: { ...text, label: 'Type' },
        color: { ...text, label: 'Color' }, min_topup: { label: 'Minimum top-up', initial: '' },
      },
    },
  },
  GroupRatio: map(ratio, 'Group name'),
  UserUsableGroups: map(text, 'Group name'),
  'claude.default_max_tokens': map(number, 'Model pattern'),
  'claude.model_headers_settings': map(map(strings, 'Header name'), 'Model pattern'),
  'gemini.safety_settings': map({ type: 'string', options: ['', 'OFF', 'BLOCK_NONE', 'BLOCK_ONLY_HIGH', 'BLOCK_MEDIUM_AND_ABOVE', 'BLOCK_LOW_AND_ABOVE', 'HARM_BLOCK_THRESHOLD_UNSPECIFIED'].map((value) => ({ value, label: value || 'Default' })) }, 'Safety category'),
  'gemini.version_settings': map(text, 'Model pattern'),
  GroupGroupRatio: map(map(ratio, 'Target group'), 'User group'),
  'group_ratio_setting.group_special_usable_group': map({ ...map(text, 'Target group'), keyModes: [
    { prefix: '', label: 'Set group' }, { prefix: '+:', label: 'Add group' }, { prefix: '-:', label: 'Remove group' },
  ] }, 'User group'),
  'global.chat_completions_to_responses_policy': {
    type: 'object',
    fields: {
      enabled: { ...flag, label: 'Enabled' },
      all_channels: { ...flag, label: 'All channels', initial: true },
      channel_ids: { ...numbers, label: 'Channel IDs' },
      channel_types: { type: 'array', label: 'Channel types', entry: {
        type: 'number', initial: 1, options: CHANNEL_TYPE_OPTIONS.map((option) => ({ value: String(option.value), label: option.label })),
      } },
      model_patterns: { ...strings, label: 'Model patterns' },
    },
  },
  'channel_affinity_setting.rules': {
    type: 'array', itemLabel: 'Rule',
    entry: {
      type: 'object',
      initial: { name: '', model_regex: [], path_regex: [], user_agent_include: [], key_sources: [{ type: 'gjson', key: '', path: '' }], ttl_seconds: 0, session_mode: 'inherit', param_override_template: {}, include_using_group: false, include_model_name: false, include_rule_name: false },
      fields: {
        name: { ...text, label: 'Rule name' },
        model_regex: { ...strings, label: 'Model patterns' },
        path_regex: { ...strings, label: 'Path patterns' },
        user_agent_include: { ...strings, label: 'User agent keywords' },
        key_sources: {
          type: 'array', label: 'Session key sources', itemLabel: 'Source', entry: {
            type: 'object', initial: { type: 'gjson', key: '', path: '' }, fields: {
              type: { type: 'string', label: 'Source', options: [
                { value: 'context_int', label: 'Context integer' }, { value: 'context_string', label: 'Context text' },
                { value: 'request_header', label: 'Request header' }, { value: 'gjson', label: 'Request body parameter' },
              ] },
              key: { ...text, label: 'Key' }, path: { ...text, label: 'Parameter path' },
            },
          },
        },
        ttl_seconds: { ...number, label: 'TTL (seconds)' },
        value_regex: { ...text, label: 'Session value regex' },
        session_mode: { ...text, label: 'Session mode', options: [
          { value: '', label: 'Legacy mode' }, { value: 'inherit', label: 'Inherit default session mode' },
          { value: 'off', label: 'Disable session binding' }, { value: 'prefer', label: 'Prefer the bound channel' },
          { value: 'strict', label: 'Require the bound channel' },
        ] },
        param_override_template: { type: 'object', label: 'Request transformation template' },
        skip_retry_on_failure: { ...flag, label: 'Skip retry on failure' },
        include_using_group: { ...flag, label: 'Include group in session key' },
        include_model_name: { ...flag, label: 'Include model in session key' },
        include_rule_name: { ...flag, label: 'Include rule name in session key' },
      },
    },
  },
};

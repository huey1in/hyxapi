/*
 * 模型与定价 wrapper — token shell with internal sub-tabs.
 */

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import ModelPricingCombined from '../../pages/Setting/Ratio/ModelPricingCombined';
import GroupRatioSettings from '../../pages/Setting/Ratio/GroupRatioSettings';
import ModelRatioNotSetEditor from '../../pages/Setting/Ratio/ModelRationNotSetEditor';
import UpstreamRatioSync from '../../pages/Setting/Ratio/UpstreamRatioSync';
import SettingsChannelAffinity from '../../pages/Setting/Operation/SettingsChannelAffinity';
import SettingGlobalModel from '../../pages/Setting/Model/SettingGlobalModel';
import SettingGeminiModel from '../../pages/Setting/Model/SettingGeminiModel';
import SettingClaudeModel from '../../pages/Setting/Model/SettingClaudeModel';
import SettingGrokModel from '../../pages/Setting/Model/SettingGrokModel';

import { API, showError, toBoolean } from '../../helpers';

const SUB_TABS = [
  { key: 'pricing', label: '模型定价', Comp: ModelPricingCombined },
  { key: 'group', label: '分组', Comp: GroupRatioSettings },
  { key: 'unset_models', label: '未设置价格', Comp: ModelRatioNotSetEditor },
  { key: 'upstream_sync', label: '上游倍率同步', Comp: UpstreamRatioSync },
  { key: 'global_model', label: '全局模型', Comp: SettingGlobalModel },
  { key: 'channel_affinity', label: '渠道亲和性', Comp: SettingsChannelAffinity },
  { key: 'gemini', label: 'Gemini', Comp: SettingGeminiModel },
  { key: 'claude', label: 'Claude', Comp: SettingClaudeModel },
  { key: 'grok', label: 'Grok', Comp: SettingGrokModel },
];

const PRETTY_JSON_KEYS = new Set([
  'gemini.safety_settings',
  'gemini.version_settings',
  'claude.model_headers_settings',
  'claude.default_max_tokens',
  'gemini.supported_imagine_models',
  'global.thinking_model_blacklist',
  'global.chat_completions_to_responses_policy',
]);

const RatioSetting = () => {
  const { t } = useTranslation();
  const [active, setActive] = useState('pricing');

  let [inputs, setInputs] = useState({
    /* pricing */
    ModelPrice: '', ModelRatio: '', CacheRatio: '', CreateCacheRatio: '',
    CompletionRatio: '', GroupRatio: '', GroupGroupRatio: '', ImageRatio: '',
    AudioRatio: '', AudioCompletionRatio: '', AutoGroups: '',
    DefaultUseAutoGroup: false, ExposeRatioEnabled: false, UserUsableGroups: '',
    'group_ratio_setting.group_special_usable_group': '',
    /* model */
    'gemini.safety_settings': '', 'gemini.version_settings': '',
    'gemini.supported_imagine_models': '',
    'gemini.remove_function_response_id_enabled': true,
    'claude.model_headers_settings': '', 'claude.thinking_adapter_enabled': true,
    'claude.default_max_tokens': '',
    'claude.thinking_adapter_budget_tokens_percentage': 0.8,
    'global.pass_through_request_enabled': false,
    'global.thinking_model_blacklist': '[]',
    'global.chat_completions_to_responses_policy': '{}',
    'general_setting.ping_interval_enabled': false,
    'general_setting.ping_interval_seconds': 60,
    'gemini.thinking_adapter_enabled': false,
    'gemini.thinking_adapter_budget_tokens_percentage': 0.6,
    'grok.violation_deduction_enabled': true,
    'grok.violation_deduction_amount': 0.05,
  });

  const [loading, setLoading] = useState(false);

  const getOptions = async () => {
    const res = await API.get('/api/option/');
    const { success, message, data } = res.data;
    if (success) {
      let newInputs = {};
      data.forEach((item) => {
        if (item.value && (item.value.startsWith('{') || item.value.startsWith('['))) {
          try {
            item.value = JSON.stringify(JSON.parse(item.value), null, 2);
          } catch {}
        } else if (PRETTY_JSON_KEYS.has(item.key) && item.value !== '') {
          try {
            item.value = JSON.stringify(JSON.parse(item.value), null, 2);
          } catch {}
        }
        if (
          ['DefaultUseAutoGroup', 'ExposeRatioEnabled'].includes(item.key) ||
          item.key.endsWith('Enabled') ||
          item.key.endsWith('enabled')
        ) {
          newInputs[item.key] = toBoolean(item.value);
        } else {
          newInputs[item.key] = item.value;
        }
      });
      setInputs(newInputs);
    } else {
      showError(message);
    }
  };

  const onRefresh = async () => {
    try {
      setLoading(true);
      await getOptions();
    } catch (error) {
      showError('刷新失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    onRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ActiveComp = SUB_TABS.find((s) => s.key === active)?.Comp || ModelPricingCombined;

  return (
    <div className='bg-ui-bg-elevated border border-ui-border rounded-xl overflow-hidden relative'>
      {loading && (
        <div className='absolute inset-0 z-10 flex items-center justify-center bg-ui-bg/60'>
          <Loader2 size={20} className='animate-spin text-ui-text-3' />
        </div>
      )}
      {/* Sub-tab bar */}
      <div className='border-b border-ui-border bg-ui-bg-subtle/40 px-2 py-1.5 overflow-x-auto'>
        <div className='flex items-center gap-0.5 min-w-max'>
          {SUB_TABS.map((s) => {
            const isActive = active === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setActive(s.key)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-ui-bg-elevated text-ui-text font-semibold border border-ui-text-3'
                    : 'border border-transparent text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle'
                }`}
              >
                {t(s.label)}
              </button>
            );
          })}
        </div>
      </div>
      <div className='p-5'>
        <ActiveComp options={inputs} refresh={onRefresh} />
      </div>
    </div>
  );
};

export default RatioSetting;

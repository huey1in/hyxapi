/*
 * 通用设置 — token-system rewrite.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';
import {
  SectionWithSave,
  FieldRow,
  TextField,
  ToggleField,
  NumberField,
  NativeSelect,
} from '../../../components/common/form/Primitives';

const DEFAULTS = {
  TopUpLink: '',
  'general_setting.docs_link': '',
  'general_setting.quota_display_type': 'USD',
  'general_setting.custom_currency_symbol': '¤',
  'general_setting.custom_currency_exchange_rate': '',
  QuotaPerUnit: '',
  RetryTimes: '',
  USDExchangeRate: '',
  DisplayTokenStatEnabled: false,
  DefaultCollapseSidebar: false,
  DemoSiteEnabled: false,
  SelfUseModeEnabled: false,
  'token_setting.max_user_tokens': 1000,
};

export default function GeneralSettings(props) {
  const { t } = useTranslation();
  const [inputs, setInputs] = useState(DEFAULTS);
  const [original, setOriginal] = useState(DEFAULTS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const next = { ...DEFAULTS };
    for (const k of Object.keys(DEFAULTS)) {
      if (k in (props.options || {})) next[k] = props.options[k];
    }
    if (
      next['general_setting.quota_display_type'] === DEFAULTS['general_setting.quota_display_type'] &&
      props.options?.['general_setting.quota_display_type'] === undefined &&
      props.options?.DisplayInCurrencyEnabled !== undefined
    ) {
      next['general_setting.quota_display_type'] = props.options.DisplayInCurrencyEnabled
        ? 'USD'
        : 'TOKENS';
    }
    setInputs(next);
    setOriginal(structuredClone(next));
  }, [props.options]);

  const set = (k) => (v) => setInputs((p) => ({ ...p, [k]: v }));

  const quotaDisplayType = inputs['general_setting.quota_display_type'];

  const showTokensOption = useMemo(() => {
    const initialType = props.options?.['general_setting.quota_display_type'];
    const initialQuotaPerUnit = parseFloat(props.options?.QuotaPerUnit);
    const legacyTokensMode =
      initialType === undefined &&
      props.options?.DisplayInCurrencyEnabled !== undefined &&
      !props.options.DisplayInCurrencyEnabled;
    return (
      initialType === 'TOKENS' ||
      legacyTokensMode ||
      (!isNaN(initialQuotaPerUnit) && initialQuotaPerUnit !== 500000)
    );
  }, [props.options]);

  const combinedRate = useMemo(() => {
    if (quotaDisplayType === 'USD') return '1';
    if (quotaDisplayType === 'CNY') return String(inputs.USDExchangeRate || '');
    if (quotaDisplayType === 'TOKENS') return String(inputs.QuotaPerUnit || '');
    if (quotaDisplayType === 'CUSTOM')
      return String(inputs['general_setting.custom_currency_exchange_rate'] || '');
    return '';
  }, [quotaDisplayType, inputs]);

  const onCombinedRateChange = (val) => {
    if (quotaDisplayType === 'CNY') set('USDExchangeRate')(val);
    else if (quotaDisplayType === 'TOKENS') set('QuotaPerUnit')(val);
    else if (quotaDisplayType === 'CUSTOM')
      set('general_setting.custom_currency_exchange_rate')(val);
  };

  const rateLabel =
    quotaDisplayType === 'TOKENS'
      ? t('每美元对应 Token 数')
      : quotaDisplayType !== 'USD'
        ? t('汇率')
        : '';

  const rateSuffix =
    quotaDisplayType === 'CNY'
      ? 'CNY (¥)'
      : quotaDisplayType === 'TOKENS'
        ? 'Tokens'
        : quotaDisplayType === 'CUSTOM'
          ? inputs['general_setting.custom_currency_symbol'] || '¤'
          : '';

  const rateHint = useMemo(() => {
    if (quotaDisplayType === 'CNY')
      return t('系统内部以美元 (USD) 为基准计价，所有金额按此汇率换算为人民币显示，不影响内部计费');
    if (quotaDisplayType === 'TOKENS')
      return t('系统内部计费精度，默认 500000，修改可能导致计费异常，请谨慎操作');
    if (quotaDisplayType === 'CUSTOM')
      return t('系统内部以美元 (USD) 为基准计价，所有金额按此汇率换算为自定义货币显示，不影响内部计费');
    return '';
  }, [quotaDisplayType, t]);

  const previewText = useMemo(() => {
    if (quotaDisplayType === 'USD') return '$1.00';
    const rate = parseFloat(combinedRate);
    if (!rate || isNaN(rate)) return t('请输入汇率');
    if (quotaDisplayType === 'CNY') return `$1.00 → ¥${rate.toFixed(2)}`;
    if (quotaDisplayType === 'TOKENS')
      return `$1.00 → ${Number(rate).toLocaleString()} Tokens`;
    if (quotaDisplayType === 'CUSTOM') {
      const symbol = inputs['general_setting.custom_currency_symbol'] || '¤';
      return `$1.00 → ${symbol}${rate.toFixed(2)}`;
    }
    return '';
  }, [quotaDisplayType, combinedRate, inputs, t]);

  const quotaTypeDesc = useMemo(() => {
    const map = {
      USD: t('站点所有额度将以美元 ($) 显示'),
      CNY: t('站点所有额度将按汇率换算为人民币 (¥) 显示'),
      TOKENS: t('站点所有额度将以原始 Token 数显示，不做货币换算'),
      CUSTOM: t('站点所有额度将按汇率换算为自定义货币显示'),
    };
    return map[quotaDisplayType] || '';
  }, [quotaDisplayType, t]);

  const submit = () => {
    const diff = compareObjects(inputs, original);
    if (!diff.length) return showWarning(t('你似乎并没有修改什么'));
    setLoading(true);
    Promise.all(
      diff.map((item) =>
        API.put('/api/option/', {
          key: item.key,
          value:
            typeof inputs[item.key] === 'boolean'
              ? String(inputs[item.key])
              : String(inputs[item.key] ?? ''),
        }),
      ),
    )
      .then((res) => {
        if (res.includes(undefined) && diff.length > 1) {
          return showError(t('部分保存失败，请重试'));
        }
        showSuccess(t('保存成功'));
        props.refresh();
      })
      .catch(() => showError(t('保存失败，请重试')))
      .finally(() => setLoading(false));
  };

  const quotaTypeOptions = [
    { value: 'USD', label: 'USD ($)' },
    { value: 'CNY', label: 'CNY (¥)' },
    ...(showTokensOption ? [{ value: 'TOKENS', label: 'Tokens' }] : []),
    { value: 'CUSTOM', label: t('自定义货币') },
  ];

  return (
    <SectionWithSave
      title={t('通用设置')}
      hint={t('链接 / 额度展示 / 重试 / 站点模式')}
      icon={Settings}
      iconColor='blue'
      loading={loading}
      onSave={submit}
      onSaveLabel={t('保存通用设置')}
    >
      <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3'>
        <FieldRow label={t('充值链接')} hint={t('例如发卡网站的购买链接')}>
          <TextField
            value={inputs.TopUpLink || ''}
            onChange={set('TopUpLink')}
            placeholder='https://...'
          />
        </FieldRow>
        <FieldRow label={t('文档地址')}>
          <TextField
            value={inputs['general_setting.docs_link'] || ''}
            onChange={set('general_setting.docs_link')}
            placeholder='https://docs.newapi.pro'
          />
        </FieldRow>
        <FieldRow label={t('失败重试次数')}>
          <NumberField
            value={Number(inputs.RetryTimes) || 0}
            onChange={(v) => set('RetryTimes')(String(v))}
            min={0}
            step={1}
          />
        </FieldRow>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3'>
        <FieldRow label={t('额度展示类型')} hint={quotaTypeDesc}>
          <NativeSelect
            value={quotaDisplayType}
            onChange={set('general_setting.quota_display_type')}
            options={quotaTypeOptions}
          />
        </FieldRow>
        {quotaDisplayType !== 'USD' && (
          <FieldRow label={rateLabel} hint={rateHint}>
            <div className='flex items-center gap-1.5'>
              <span className='text-xs text-ui-text-3 whitespace-nowrap'>1 USD =</span>
              <TextField
                value={combinedRate}
                onChange={onCombinedRateChange}
                placeholder='0'
              />
              <span className='text-xs text-ui-text-3 whitespace-nowrap'>{rateSuffix}</span>
            </div>
          </FieldRow>
        )}
        {quotaDisplayType === 'CUSTOM' && (
          <FieldRow
            label={t('自定义货币符号')}
            hint={t('显示在额度数值前，如 €1.50')}
          >
            <TextField
              value={inputs['general_setting.custom_currency_symbol'] || ''}
              onChange={set('general_setting.custom_currency_symbol')}
              placeholder='€, £, Rp, ₩, ₹...'
            />
          </FieldRow>
        )}
      </div>

      <div className='text-xs text-ui-text-3'>
        {t('预览效果')}：
        <span className='ml-1 font-mono text-ui-text'>{previewText}</span>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <ToggleField
          label={t('额度查询接口返回令牌额度而非用户额度')}
          checked={!!inputs.DisplayTokenStatEnabled}
          onChange={set('DisplayTokenStatEnabled')}
        />
        <ToggleField
          label={t('默认折叠侧边栏')}
          checked={!!inputs.DefaultCollapseSidebar}
          onChange={set('DefaultCollapseSidebar')}
        />
        <ToggleField
          label={t('演示站点模式')}
          checked={!!inputs.DemoSiteEnabled}
          onChange={set('DemoSiteEnabled')}
        />
        <ToggleField
          label={t('自用模式')}
          hint={t('开启后不限制；必须设置模型倍率')}
          checked={!!inputs.SelfUseModeEnabled}
          onChange={set('SelfUseModeEnabled')}
        />
      </div>

      <FieldRow
        label={t('用户最大令牌数量')}
        hint={t('每个用户最多可创建的令牌数量，默认 1000；设置过大可能影响性能')}
      >
        <NumberField
          value={Number(inputs['token_setting.max_user_tokens']) || 1000}
          onChange={(v) =>
            set('token_setting.max_user_tokens')(parseInt(v) || 1000)
          }
          min={1}
          step={1}
        />
      </FieldRow>
    </SectionWithSave>
  );
}

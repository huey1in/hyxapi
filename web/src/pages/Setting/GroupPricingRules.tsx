import { useTranslation } from 'react-i18next';
import VisualConfigEditor from '../../components/config/VisualConfigEditor';
import { settingConfigShapes } from './setting-config-shapes';
import { validGroupPricingRule } from './group-pricing-rules';
import type { GroupPricingRuleKey } from './group-pricing-rules';

const fields: { key: GroupPricingRuleKey; title: string; description: string }[] = [
  { key: 'GroupGroupRatio', title: 'Group multipliers by user group', description: 'Override the target group multiplier for each user group. Zero makes requests free.' },
  { key: 'group_ratio_setting.group_special_usable_group', title: 'Usable groups by user group', description: 'Choose whether to set, add or remove each target group. Values are the displayed group descriptions.' },
];

export default function GroupPricingRules({ value, onChange, disabled = false }: { value: (key: string) => string; onChange: (key: string, value: string) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  return <section aria-label={t('Account group rules')} className='min-w-0 space-y-5'>
    <h2 className='text-[15px] font-semibold text-ui-text'>{t('Account group rules')}</h2>
    <p className='text-xs leading-relaxed text-ui-text-3'>{t('Users always retain access to their own group.')}</p>
    {fields.map((field) => <fieldset key={field.key} disabled={disabled} className='min-w-0 space-y-3'>
      <legend className='text-sm font-medium text-ui-text-2'>{t(field.title)}</legend>
      <p className='text-xs leading-relaxed text-ui-text-3'>{t(field.description)}</p>
      <VisualConfigEditor configKey={field.key} label={field.title} value={value(field.key)}
        shape={settingConfigShapes[field.key]} validate={(raw) => validGroupPricingRule(field.key, raw)}
        onChange={(next) => onChange(field.key, next)} />
    </fieldset>)}
  </section>;
}

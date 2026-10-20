import { useTranslation } from 'react-i18next';
import { Textarea } from '../../components/ui';
import { validGroupPricingRule } from './group-pricing-rules';
import type { GroupPricingRuleKey } from './group-pricing-rules';

const fields: { key: GroupPricingRuleKey; title: string; description: string; example: string }[] = [
  { key: 'GroupGroupRatio', title: 'Group multipliers by user group', description: 'Override the target group multiplier for each user group. Zero makes requests free.', example: '{\n  "vip": { "default": 0.8 }\n}' },
  { key: 'group_ratio_setting.group_special_usable_group', title: 'Usable groups by user group', description: 'Use +:group to add a group and -:group to remove one. Values are the displayed group descriptions.', example: '{\n  "vip": { "+:premium": "Premium", "-:default": "" }\n}' },
];

export default function GroupPricingRules({ value, onChange, disabled = false }: { value: (key: string) => string; onChange: (key: string, value: string) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  return <section aria-label={t('Account group rules')} className='min-w-0 space-y-5 rounded-[26px] border border-ui-border px-[22px] py-5'>
    <h2 className='text-[15px] font-semibold text-ui-text'>{t('Account group rules')}</h2>
    <p className='text-xs leading-relaxed text-ui-text-3'>{t('Users always retain access to their own group.')}</p>
    {fields.map((field) => {
      const raw = value(field.key); const invalid = !validGroupPricingRule(field.key, raw);
      return <label key={field.key} className='block min-w-0 space-y-2'>
        <span className='block text-xs text-ui-text-2'>{t(field.title)}</span>
        <span className='block text-xs leading-relaxed text-ui-text-3'>{t(field.description)}</span>
        <details className='text-xs text-ui-text-3'><summary>{t('Example JSON')}</summary><pre className='mt-2 whitespace-pre-wrap break-all rounded-xl bg-ui-bg-subtle p-3 font-mono'>{field.example}</pre></details>
        <Textarea aria-label={t(field.title)} width='full' value={raw} onChange={(next) => onChange(field.key, next)} rows={6} placeholder={field.example} disabled={disabled} invalid={invalid} data-setting-invalid={invalid ? 'true' : undefined} />
        {invalid && <span role='alert' className='block text-xs text-ui-text-2'>{t('Enter a JSON object with valid group rules before saving.')}</span>}
      </label>;
    })}
  </section>;
}

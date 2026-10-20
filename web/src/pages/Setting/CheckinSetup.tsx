import { useTranslation } from 'react-i18next';
import { NumberInput, Switch } from '../../components/ui';
import { getCurrencyConfig } from '../../helpers';
import {
  displayAmountToQuota,
  quotaToDisplayAmount,
} from '../../helpers/quota';

export default function CheckinSetup({
  value,
  onChange,
}: {
  value: (key: string) => string;
  onChange: (key: string, value: string) => void;
}) {
  const { t } = useTranslation();
  const minRaw = value('checkin_setting.min_quota');
  const maxRaw = value('checkin_setting.max_quota');
  const min = Number(minRaw);
  const max = Number(maxRaw);
  const invalid =
    !minRaw.trim() ||
    !maxRaw.trim() ||
    !Number.isSafeInteger(min) ||
    min < 0 ||
    !Number.isSafeInteger(max) ||
    max < min;
  const currency = getCurrencyConfig();
  return (
    <section className='rounded-[26px] border border-ui-border px-[22px] py-5'>
      <h3 className='mb-4 text-[15px] font-semibold text-ui-text'>
        {t('Daily Check-in')}
      </h3>
      <p className='mb-4 text-xs text-ui-text-3'>
        {t('Check in daily to earn quota rewards')}
      </p>
      <div className='mb-4 flex items-center justify-between gap-3'>
        <span className='text-sm text-ui-text'>
          {t('Enable daily check-in')}
        </span>
        <Switch
          aria-label={t('Enable daily check-in')}
          checked={value('checkin_setting.enabled') === 'true'}
          onChange={(enabled) =>
            onChange('checkin_setting.enabled', String(enabled))
          }
        />
      </div>
      <div className='grid gap-4 sm:grid-cols-2'>
        {[
          { key: 'min_quota', label: 'Minimum check-in reward' },
          { key: 'max_quota', label: 'Maximum check-in reward' },
        ].map((field) => (
          <label key={field.key} className='text-xs text-ui-text-3'>
            <span className='mb-2 block'>
              {t(field.label)} (
              {currency.type === 'TOKENS' ? t('Quota') : currency.symbol})
            </span>
            <NumberInput
              aria-label={t(field.label)}
              width='full'
              min={0}
              step='any'
              data-setting-invalid={invalid ? 'true' : undefined}
              invalid={invalid}
              value={
                value(`checkin_setting.${field.key}`).trim() === ''
                  ? ''
                  : quotaToDisplayAmount(
                      Number(value(`checkin_setting.${field.key}`)),
                    )
              }
              onChange={(amount) =>
                onChange(
                  `checkin_setting.${field.key}`,
                  amount === '' ? '' : String(displayAmountToQuota(amount)),
                )
              }
            />
          </label>
        ))}
      </div>
      {invalid && (
        <p role='alert' className='mt-3 text-xs text-ui-text-2'>
          {t('Invalid check-in reward configuration')}
        </p>
      )}
    </section>
  );
}

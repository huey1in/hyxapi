import { useEffect, useId, useState } from 'react';
import { Store } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { API, showSuccess } from '../../helpers';
import {
  FormField,
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  NumberInput,
  Select,
  Switch,
  Textarea,
  showError,
} from '../../components/ui';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { apiErrorMessage } from '../../lib/api-error';
import { paymentSetupGroups } from './payment-setup-fields';
import type { PaymentField } from './payment-setup-fields';
import {
  pancakeBindingSchema,
  pancakeCatalogSchema,
  PancakeOrphanStoreError,
  parsePaymentSetupReply,
  validPaymentSetting,
} from './payment-setup-data';
import type { PancakeCredentials, PancakeStore } from './payment-setup-data';
import VisualConfigEditor from '../../components/config/VisualConfigEditor';
import { paymentConfigShapes } from './payment-config-shapes';

type Props = {
  value: (key: string) => string;
  onChange: (key: string, value: string) => void;
  onConfirmed?: (persisted: Record<string, string>) => unknown;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
};
const bool = (value: string) => value === 'true' || value === '1';
const requestConfig = {
  timeout: 30000,
  skipErrorHandler: true,
  disableDuplicate: true,
};
async function paymentSetupRequest<T extends z.ZodType>(
  method: string,
  url: string,
  schema: T,
  signal: AbortSignal,
  body?: unknown,
): Promise<z.output<T>> {
  const response = await API.request<unknown>({
    ...requestConfig,
    method,
    url,
    signal,
    data: body,
  });
  signal.throwIfAborted();
  return parsePaymentSetupReply(response.data, schema);
}

function CreatePair({
  credentials,
  onClose,
  onCreated,
  onOrphan,
}: {
  credentials: PancakeCredentials;
  onClose: () => void;
  onCreated: (store: string, product: string) => void;
  onOrphan: (store: string) => void;
}) {
  const { t } = useTranslation();
  const { busy, run } = useOwnedOperation();
  return (
    <ConfirmDialog
      open
      title={t('创建商店和充值商品？')}
      description={t(
        '将在当前 Pancake 商户下创建新商店与商品，创建完成后请保存并绑定。',
      )}
      loading={busy}
      closeOnConfirm={false}
      confirmText={t('Create')}
      cancelText={t('Cancel')}
      onClose={onClose}
      onConfirm={() =>
        void run(async (signal) => {
          try {
            const result = await paymentSetupRequest(
              'post',
              '/api/option/waffo-pancake/pair',
              pancakeBindingSchema,
              signal,
              credentials,
            );
            onCreated(result.store_id, result.product_id);
            showSuccess(t('已创建，请保存并绑定'));
          } catch (error) {
            signal.throwIfAborted();
            if (error instanceof PancakeOrphanStoreError) {
              showError(t(error.message));
              onOrphan(error.storeID);
              return;
            }
            throw error;
          }
        })
      }
    />
  );
}

export default function PaymentSetup({
  value,
  onChange,
  onConfirmed,
  onBusyChange,
  disabled = false,
}: Props) {
  const { t } = useTranslation();
  const { busy, run } = useOwnedOperation();
  const formID = useId();
  const [stores, setStores] = useState<PancakeStore[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [confirmPair, setConfirmPair] = useState<PancakeCredentials | null>(
    null,
  );
  useEffect(() => {
    onBusyChange?.(busy || Boolean(confirmPair));
    return () => onBusyChange?.(false);
  }, [busy, confirmPair, onBusyChange]);
  const blocked = disabled || busy || Boolean(confirmPair);
  const credentials = (): PancakeCredentials => ({
    merchant_id: value('WaffoPancakeMerchantID'),
    private_key: value('WaffoPancakePrivateKey'),
    return_url: value('WaffoPancakeReturnURL'),
  });
  const loadCatalog = () =>
    void run(async (signal) => {
      setStores([]);
      setLoaded(false);
      setCatalogError('');
      try {
        const result = await paymentSetupRequest(
          'get',
          '/api/option/waffo-pancake/catalog',
          pancakeCatalogSchema,
          signal,
        );
        setStores(result.stores);
        setLoaded(true);
      } catch (error) {
        signal.throwIfAborted();
        setCatalogError(
          apiErrorMessage(error, 'Unable to load the payment catalog'),
        );
        throw error;
      }
    });
  const saveBinding = () =>
    void run(async (signal) => {
      const draft = credentials();
      const requested = {
        ...draft,
        store_id: value('WaffoPancakeStoreID'),
        product_id: value('WaffoPancakeProductID'),
      };
      if (!requested.store_id.trim() || !requested.product_id.trim())
        throw new Error('Choose a store and product before binding.');
      const result = await paymentSetupRequest(
        'post',
        '/api/option/waffo-pancake/save',
        pancakeBindingSchema,
        signal,
        requested,
      );
      showSuccess(t('已绑定商店和商品'));
      onConfirmed?.({
        WaffoPancakeMerchantID: draft.merchant_id,
        WaffoPancakePrivateKey: draft.private_key,
        WaffoPancakeReturnURL: draft.return_url,
        WaffoPancakeStoreID: result.store_id,
        WaffoPancakeProductID: result.product_id,
      });
    });
  const field = ([key, label, type]: PaymentField) => {
    const text = value(key);
    const invalid = !validPaymentSetting(key, text);
    const inputID = `${formID}-${key}`;
    return (
      <div
        key={key}
        className={`text-sm text-ui-text-2 space-y-1.5 min-w-0 ${type?.startsWith('json') || type === 'pem' ? 'sm:col-span-2' : ''}`}
      >
        <label htmlFor={inputID} className='block'>
          {t(label)}
        </label>
        {type === 'bool' ? (
          <Switch
            id={inputID}
            checked={bool(text)}
            onChange={(next) => onChange(key, String(next))}
          />
        ) : type === 'number' ? (
          <NumberInput
            id={inputID}
            width='full'
            value={
              text.trim() && Number.isFinite(Number(text)) ? Number(text) : ''
            }
            min={key.endsWith('MinTopUp') ? 1 : 0}
            step={key.endsWith('MinTopUp') ? 1 : 0.01}
            invalid={invalid}
            data-setting-invalid={invalid ? 'true' : undefined}
            onChange={(next) => onChange(key, String(next))}
          />
        ) : type?.startsWith('json') ? (
          <VisualConfigEditor configKey={key} label={label} value={text} shape={paymentConfigShapes[key]}
            validate={(raw) => validPaymentSetting(key, raw)} onChange={(next) => onChange(key, next)} />
        ) : type === 'pem' ? (
          <Textarea
            id={inputID}
            value={text}
            onChange={(next) => onChange(key, next)}
            rows={3}
            spellCheck={false}
            placeholder={t('已保存的密钥不回显，留空保留原值')}
            invalid={invalid}
            data-setting-invalid={invalid ? 'true' : undefined}
          />
        ) : (
          <Input
            id={inputID}
            width='full'
            type={type === 'secret' ? 'password' : 'text'}
            value={text}
            onChange={(next) => onChange(key, next)}
            autoComplete='off'
            invalid={invalid}
            placeholder={type === 'secret' ? t('留空保留已保存的密钥') : ''}
          />
        )}
        {invalid && (
          <span role='alert' className='text-xs text-ui-danger'>
            {t(
              'Complete valid payment amounts, limits and configuration before saving.',
            )}
          </span>
        )}
        {key === 'CreemProducts' && (
          <span className='block text-xs text-ui-text-3 break-all'>
            {t('Quota uses internal quota units. For example, 5000000 credits $10 with the default quota rate.')}
          </span>
        )}
      </div>
    );
  };
  return (
    <div className='min-w-0'>
      <fieldset disabled={blocked} className='min-w-0 divide-y divide-ui-border'>
        {paymentSetupGroups.map(([title, fields]) => (
          <section
            key={title}
            className='min-w-0 py-7 first:pt-0 last:pb-0'
          >
            <h2 className='text-[15px] font-semibold text-ui-text'>
              {t(title)}
            </h2>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4'>
              {fields.map(field)}
            </div>
            {title === 'Stripe' && (
              <p className='text-xs text-ui-text-3 mt-3'>
                {t(
                  'The unit price must match the USD price of the Stripe Price ID. Group multipliers affect credited quota; use promotion codes for Stripe discounts.',
                )}{' '}
                {t('Webhook URL')}: {window.location.origin}/api/stripe/webhook
              </p>
            )}
            {title === 'Creem' && (
              <p className='text-xs text-ui-text-3 mt-3'>
                {t('Webhook URL')}: {window.location.origin}/api/creem/webhook
              </p>
            )}
            {title === 'Waffo Pancake' && (
              <div className='space-y-3 mt-4'>
                <p className='text-xs text-ui-text-3'>
                  {t(
                    '先保存凭据，再读取商店目录；也可创建商店和充值商品后绑定。',
                  )}{' '}
                  {t('Webhook URL')}: {window.location.origin}
                  /api/waffo-pancake/webhook/prod {t('or')} /test
                </p>
                <div className='flex flex-wrap gap-2'>
                  <Button size='sm' loading={busy} onClick={loadCatalog}>
                    {t('读取已保存凭据的商店')}
                  </Button>
                  <Button
                    size='sm'
                    onClick={() => setConfirmPair(credentials())}
                  >
                    {t('创建商店和充值商品')}
                  </Button>
                  <Button size='sm' loading={busy} onClick={saveBinding}>
                    {t('保存并绑定')}
                  </Button>
                </div>
                {catalogError && (
                  <div
                    role='alert'
                    className='space-y-2 text-sm text-ui-danger'
                  >
                    <p>{t(catalogError)}</p>
                    <Button size='sm' variant='toggle' onClick={loadCatalog}>
                      {t('Retry')}
                    </Button>
                  </div>
                )}
                {loaded && !stores.length && (
                  <EmptyState icon={Store} padding='sm' title={t('No payment stores found')} />
                )}
                {stores.length > 0 && (
                  <>
                    <FormField label={t('Payment store')}><Select popover
                      aria-label={t('Payment store')}
                      width='full'
                      value={value('WaffoPancakeStoreID')}
                      options={stores.map((store) => ({
                        value: store.id,
                        label: store.name || store.id,
                      }))}
                      onChange={(next) => {
                        onChange('WaffoPancakeStoreID', next);
                        onChange('WaffoPancakeProductID', '');
                      }}
                    /></FormField>
                    <FormField label={t('Top-up product')}><Select popover
                      aria-label={t('Top-up product')}
                      width='full'
                      value={value('WaffoPancakeProductID')}
                      options={(
                        stores.find(
                          (store) => store.id === value('WaffoPancakeStoreID'),
                        )?.onetimeProducts || []
                      ).map((product) => ({
                        value: product.id,
                        label: product.name || product.id,
                      }))}
                      onChange={(next) =>
                        onChange('WaffoPancakeProductID', next)
                      }
                    /></FormField>
                  </>
                )}
              </div>
            )}
          </section>
        ))}
      </fieldset>
      {confirmPair && (
        <CreatePair
          credentials={confirmPair}
          onClose={() => setConfirmPair(null)}
          onCreated={(store, product) => {
            onChange('WaffoPancakeStoreID', store);
            onChange('WaffoPancakeProductID', product);
            setConfirmPair(null);
          }}
          onOrphan={(store) => {
            onChange('WaffoPancakeStoreID', store);
            onChange('WaffoPancakeProductID', '');
            setConfirmPair(null);
          }}
        />
      )}
    </div>
  );
}

import { useEffect, useId, useState } from 'react';
import { Store } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { API, showSuccess } from '../../helpers';
import {
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
  complianceConfirmationSchema,
  pancakeBindingSchema,
  pancakeCatalogSchema,
  PancakeOrphanStoreError,
  parsePaymentSetupReply,
  validPaymentSetting,
} from './payment-setup-data';
import type { PancakeCredentials, PancakeStore } from './payment-setup-data';

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
  const [agreement, setAgreement] = useState('');
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
  const confirmed =
    bool(value('payment_setting.compliance_confirmed')) &&
    value('payment_setting.compliance_terms_version') === 'v1';
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
        ) : type === 'pem' || type?.startsWith('json') ? (
          <Textarea
            id={inputID}
            value={text}
            onChange={(next) => onChange(key, next)}
            rows={type === 'pem' ? 3 : 5}
            spellCheck={false}
            placeholder={
              type === 'pem'
                ? t('已保存的密钥不回显，留空保留原值')
                : type === 'json-array'
                  ? '[]'
                  : '{}'
            }
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
              'Enter valid payment amounts, limits and JSON configuration before saving.',
            )}
          </span>
        )}
        {key === 'CreemProducts' && (
          <span className='block text-xs text-ui-text-3 break-all'>
            {t('Creem example: {{example}}. quota uses internal quota units.', {
              example:
                '[{"productId":"prod_…","name":"Starter","price":10,"currency":"USD","quota":5000000}]',
            })}
          </span>
        )}
        {key === 'WaffoPayMethods' && (
          <span className='block text-xs text-ui-text-3 break-all'>
            {t('Example JSON')}:{' '}
            {
              '[{"name":"Card","payMethodType":"CREDITCARD,DEBITCARD","payMethodName":""}]'
            }
          </span>
        )}
      </div>
    );
  };
  return (
    <div className='space-y-5 min-w-0'>
      <fieldset disabled={blocked} className='space-y-5 min-w-0'>
        <div className='border border-ui-border rounded-[26px] p-5 space-y-3'>
          <h2 className='text-base font-semibold text-ui-text'>
            {t('支付与订阅')}
          </h2>
          {confirmed ? (
            <p className='text-sm text-ui-text-3'>
              {t(
                'Payment statement confirmed ({{version}}). Use Save at the top of the page after changing configuration.',
                { version: value('payment_setting.compliance_terms_version') },
              )}
            </p>
          ) : (
            <>
              <p className='text-sm text-ui-text-2'>
                {t('启用支付、兑换和邀请奖励前，请确认上游的运营声明：')}
              </p>
              <ol className='list-decimal pl-5 space-y-1 text-sm text-ui-text-3'>
                <li>
                  {t('已合法取得所接入 API、账户、密钥和额度的使用授权。')}
                </li>
                <li>
                  {t(
                    '在授权范围内提供服务，不进行未经授权的转售或其他违规使用。',
                  )}
                </li>
                <li>
                  {t(
                    '面向中国大陆公众提供生成式 AI 服务时，履行适用的相关义务。',
                  )}
                </li>
                <li>
                  {t('遵守适用法律、平台规则，维护公共利益和第三方权益。')}
                </li>
                <li>{t('独立承担部署、运营和收费产生的法律责任。')}</li>
                <li>
                  {t(
                    '本声明属于风险提示，不构成法律意见或合规保证；必要时咨询专业顾问。',
                  )}
                </li>
              </ol>
              <Input
                value={agreement}
                onChange={setAgreement}
                placeholder={t('Type: {{confirmation}}', {
                  confirmation: t('我已阅读并确认'),
                })}
                aria-label={t('支付声明确认文字')}
              />
              <Button
                disabled={agreement !== t('我已阅读并确认')}
                loading={busy}
                onClick={() =>
                  void run(async (signal) => {
                    await paymentSetupRequest(
                      'post',
                      '/api/option/payment_compliance',
                      complianceConfirmationSchema,
                      signal,
                      { confirmed: true },
                    );
                    showSuccess(t('已确认'));
                    onConfirmed?.({});
                  })
                }
              >
                {t('确认支付服务声明')}
              </Button>
            </>
          )}
        </div>
        {paymentSetupGroups.map(([title, fields]) => (
          <details
            key={title}
            className='border border-ui-border rounded-[26px] p-5'
          >
            <summary className='cursor-pointer text-sm font-semibold text-ui-text'>
              {t(title)}
            </summary>
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
                    <Select
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
                    />
                    <Select
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
                    />
                  </>
                )}
              </div>
            )}
          </details>
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

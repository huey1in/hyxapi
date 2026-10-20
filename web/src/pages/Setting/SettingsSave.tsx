import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { z } from 'zod';
import { API, setStatusData, showSuccess } from '../../helpers';
import { ConfirmDialog, showError } from '../../components/ui';
import { StatusContext } from '../../context/Status';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { apiErrorMessage } from '../../lib/api-error';
import {
  domainImpactSchema,
  domainKeys,
  parseSettingReply,
} from './setting-data';
import type { DomainImpact, Settings } from './setting-data';
import { isRequestPolicyKey } from './setting-fields';
import { orderSettingKeysForSave } from './saveOrder';

export const settingsRequestConfig = {
  timeout: 30000,
  disableDuplicate: true,
  skipErrorHandler: true,
};
type Props = {
  changes: Settings;
  stored: Settings;
  onAck: (values: Settings, canonical?: Settings) => void;
  onClose: () => void;
};
export default function SettingsSave({
  changes,
  stored,
  onAck,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const { busy, run } = useOwnedOperation();
  const [, dispatch] = useContext(StatusContext);
  const queries = useQueryClient();
  const [impact, setImpact] = useState<DomainImpact | null>(null);
  const execute = (confirmation = '') =>
    void run(async (signal) => {
      // Let mount cleanup cancel the operation before the first write (StrictMode).
      await Promise.resolve();
      signal.throwIfAborted();
      let review = false;
      try {
        const keys = orderSettingKeysForSave(Object.keys(changes));
        if (keys.some((key: string) => domainKeys.includes(key))) {
          const value = (key: string) => changes[key] ?? stored[key] ?? '';
          const body = {
            rp_id: value('passkey.rp_id'),
            legacy_rp_ids: value('passkey.legacy_rp_ids'),
            origins: value('passkey.origins'),
            server_address: value('ServerAddress'),
          };
          if (!confirmation) {
            const { data } = await API.put(
              '/api/option/passkey/domains',
              { ...body, preview: true },
              { ...settingsRequestConfig, signal },
            );
            signal.throwIfAborted();
            const preview = parseSettingReply(data, domainImpactSchema);
            if (preview.confirmation_required) {
              review = true;
              setImpact(preview);
              return;
            }
          }
          const { data } = await API.put(
            '/api/option/passkey/domains',
            { ...body, removal_confirmation: confirmation },
            { ...settingsRequestConfig, signal },
          );
          signal.throwIfAborted();
          const saved = parseSettingReply(data, domainImpactSchema);
          onAck(
            Object.fromEntries(
              keys
                .filter((key: string) => domainKeys.includes(key))
                .map((key: string) => [key, changes[key]]),
            ),
            { 'passkey.rp_id': saved.rp_id, 'passkey.legacy_rp_ids': saved.legacy_rp_ids, 'passkey.origins': saved.origins, ServerAddress: body.server_address },
          );
        }
        const policy = Object.fromEntries(
          keys
            .filter(isRequestPolicyKey)
            .map((key: string) => [key, changes[key]]),
        );
        if (Object.keys(policy).length) {
          const { data } = await API.patch(
            '/api/option/request_policy',
            { options: policy },
            { ...settingsRequestConfig, signal },
          );
          signal.throwIfAborted();
          parseSettingReply(data, z.unknown());
          onAck(policy);
        }
        for (const key of keys) {
          signal.throwIfAborted();
          if (domainKeys.includes(key) || isRequestPolicyKey(key)) continue;
          const { data } = await API.put(
            '/api/option/',
            { key, value: changes[key] },
            { ...settingsRequestConfig, signal },
          );
          signal.throwIfAborted();
          try {
            parseSettingReply(data, z.unknown());
          } catch (error) {
            throw new Error(`${key}: ${apiErrorMessage(error)}`);
          }
          onAck({ [key]: changes[key] });
        }
        // Persistence has already been acknowledged. A status refresh failure must
        // not restore saved drafts or make the user repeat successful writes.
        try {
          const { data } = await API.get('/api/status', {
            ...settingsRequestConfig,
            signal,
          });
          signal.throwIfAborted();
          const status = parseSettingReply(
            data,
            z.looseObject({ version: z.string().optional() }),
          );
          dispatch({ type: 'set', payload: status });
          setStatusData(status);
          if (keys.includes('Notice'))
            await queries.invalidateQueries({ queryKey: ['site-notice'] });
          signal.throwIfAborted();
        } catch (error) {
          if (!signal.aborted)
            showError(
              t(
                'Settings were saved, but refreshing public status failed. Refresh the page to retry.',
              ),
            );
        }
        if (!signal.aborted) showSuccess(t('Saved'));
      } catch (error) {
        if (signal.aborted) return;
        const conflict = isAxiosError(error)
          ? z
              .object({
                code: z.literal('PASSKEY_RP_ID_REMOVAL_CONFIRMATION_REQUIRED'),
                data: domainImpactSchema,
              })
              .safeParse(error.response?.data)
          : null;
        if (conflict?.success) {
          review = true;
          setImpact(conflict.data.data);
        } else {
          const message = apiErrorMessage(error);
          if (message) showError(t(message));
        }
      } finally {
        if (!signal.aborted && !review) onClose();
      }
    });
  useEffect(() => {
    execute();
  }, []);
  return impact ? (
    <ConfirmDialog
      open
      title={t('Confirm Passkey domain removal')}
      description={t(
        'Remove {{domains}}? This affects {{affected}} credentials; {{unknown}} older credentials have an unknown domain. Keep another working sign-in method.',
        {
          domains: impact.removed_rp_ids.join(', '),
          affected: impact.affected_credentials,
          unknown: impact.unknown_credentials,
        },
      )}
      onClose={onClose}
      onConfirm={() => execute(impact.removal_confirmation)}
      loading={busy}
      closeOnConfirm={false}
      confirmText={t('Confirm save')}
      cancelText={t('Cancel')}
    />
  ) : null;
}

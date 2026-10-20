import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { API, showSuccess } from '../../helpers';
import { Button, Input, showError } from '../../components/ui';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { parseSettingReply } from './setting-data';
import { settingsRequestConfig } from './SettingsSave';

export default function EmailTest({ disabled }: { disabled: boolean }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const { busy, run } = useOwnedOperation();
  const send = () => {
    if (!z.email().safeParse(email.trim()).success) {
      showError(t('Enter a valid recipient email address'));
      return;
    }
    const recipient = email.trim();
    void run(async (signal) => {
      const { data } = await API.post(
        '/api/option/test_email',
        { email: recipient },
        { ...settingsRequestConfig, signal },
      );
      signal.throwIfAborted();
      parseSettingReply(data, z.unknown());
      showSuccess(t('Test email sent'));
    });
  };
  return (
    <div className='mt-4 space-y-2 border-t border-ui-border pt-4'>
      <div className='text-xs text-ui-text-3'>{t('Send test email')}</div>
      <p className='text-xs text-ui-text-3'>
        {t(
          'The test uses saved SMTP settings. Save your changes before testing.',
        )}
      </p>
      <div className='flex flex-wrap items-center gap-2'>
        <Input
          aria-label={t('Test recipient email')}
          value={email}
          onChange={setEmail}
          disabled={disabled || busy}
          width={280}
        />
        <Button size='sm' loading={busy} disabled={disabled} onClick={send}>
          {t('Send test email')}
        </Button>
      </div>
    </div>
  );
}

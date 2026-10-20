import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui';

type Turnstile = {
  render: (container: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void; 'error-callback': () => void; size: 'flexible' }) => string;
  remove: (id: string) => void;
};
const turnstileWindow = () => window as Window & { turnstile?: Turnstile };

export default function TurnstileChallenge({ siteKey, onToken }: { siteKey: string; onToken: (token: string) => void }) {
  const { t } = useTranslation();
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false;
    let widget: string | undefined;
    setFailed(false); onToken('');
    const error = () => { if (!disposed) { onToken(''); setFailed(true); } };
    const render = () => {
      if (disposed || !container.current || !turnstileWindow().turnstile) return;
      container.current.replaceChildren();
      try { widget = turnstileWindow().turnstile!.render(container.current, {
        sitekey: siteKey, size: 'flexible',
        callback: (token) => { if (!disposed) { setFailed(false); onToken(token); } },
        'expired-callback': () => { if (!disposed) onToken(''); }, 'error-callback': error,
      }); } catch { error(); }
    };
    let script: HTMLScriptElement | null = null;
    if (turnstileWindow().turnstile) render();
    else {
      script = document.querySelector<HTMLScriptElement>('script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]');
      if (!script) {
        script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true;
        script.addEventListener('load', render); script.addEventListener('error', error); document.head.appendChild(script);
      } else { script.addEventListener('load', render); script.addEventListener('error', error); }
    }
    return () => {
      disposed = true; script?.removeEventListener('load', render); script?.removeEventListener('error', error);
      if (widget !== undefined) turnstileWindow().turnstile?.remove(widget);
    };
  }, [siteKey, onToken, attempt]);
  return <div className='min-w-0'>
    <div ref={container} />
    {failed && <div role='alert' className='text-sm text-ui-text-2'>{t('Unable to load security verification')} <Button variant='link' onClick={() => {
      const script = document.querySelector<HTMLScriptElement>('script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]');
      if (!turnstileWindow().turnstile) script?.remove();
      setAttempt((value) => value + 1);
    }}>{t('Retry')}</Button></div>}
  </div>;
}

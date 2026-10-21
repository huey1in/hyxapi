import { Component } from 'react';
import type { PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { isChunkLoadError, recoverChunkLoad } from '../../lib/chunk-recovery';
import { Button } from '../ui';

function LoadFailure() {
  const { t } = useTranslation();
  return <div role='alert' className='space-y-3 p-8 text-sm text-ui-text-2'>
    <p>{t('Unable to load page. Refresh to try again.')}</p>
    <Button variant='toggle' onClick={() => window.location.reload()}>{t('Refresh')}</Button>
  </div>;
}

export default class RouteLoadBoundary extends Component<PropsWithChildren, { failed: boolean; error: unknown }> {
  state = { failed: false, error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { failed: true, error };
  }

  componentDidCatch(error: unknown) {
    if (!isChunkLoadError(error)) return;
    try { recoverChunkLoad(window.sessionStorage, () => window.location.reload()); } catch { /* Show the retry action when storage is unavailable. */ }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    if (!isChunkLoadError(this.state.error)) throw this.state.error;
    return <LoadFailure />;
  }
}

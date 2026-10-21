import type { PropsWithChildren, ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ConsolePageHeader from '../../components/layout/ConsolePageHeader';
import { PERSONAL_SETTINGS_TABS } from './personal-navigation';
import type { PersonalSettingsTab } from './personal-navigation';

export function PersonalSettingsHeader({ tab, onChange }: { tab: PersonalSettingsTab; onChange?: (tab: PersonalSettingsTab) => void }) {
  const { t, i18n } = useTranslation();
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navigation.current;
    if (!nav) return;
    const reveal = () => {
      const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
      if (!active) return;
      const bounds = nav.getBoundingClientRect();
      const item = active.getBoundingClientRect();
      if (item.left < bounds.left) nav.scrollLeft += item.left - bounds.left;
      else if (item.right > bounds.right) nav.scrollLeft += item.right - bounds.right;
    };
    reveal();
    const resize = new ResizeObserver(reveal);
    resize.observe(nav);
    return () => resize.disconnect();
  }, [tab, i18n.language]);
  return <div className='min-w-0 space-y-4'>
    <ConsolePageHeader title={t('设置')} />
    <nav ref={navigation} aria-label={t('Settings categories')} className='flex gap-4 overflow-x-auto border-b border-ui-border'>
      {PERSONAL_SETTINGS_TABS.map((item) => <button key={item.value} type='button' aria-current={tab === item.value ? 'page' : undefined} disabled={!onChange}
        onClick={() => onChange?.(item.value)} className={`shrink-0 whitespace-nowrap border-b-2 px-1 py-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${tab === item.value ? 'border-ui-text text-ui-text' : 'border-transparent text-ui-text-3 hover:text-ui-text'}`}>
        {t(item.label)}
      </button>)}
    </nav>
  </div>;
}

export const SettingGroup = ({ title, children }: PropsWithChildren<{ title: ReactNode }>) => (
  <div data-setting-group={typeof title === 'string' ? title : undefined} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ui-text-3)', letterSpacing: '0.03em', paddingLeft: 2 }}>{title}</span>
    <div style={{ border: '1px solid #e9e9e9', borderRadius: 16, overflow: 'hidden' }}>
      {children}
    </div>
  </div>
);

export const SettingRow = ({ title, description, children, last }: PropsWithChildren<{ title: ReactNode; description?: ReactNode; last?: boolean }>) => (
  <div style={{
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '14px 16px',
    borderBottom: last ? 'none' : '1px solid #eee',
  }}>
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ui-text)' }}>{title}</div>
      {description && <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginTop: 3, lineHeight: 1.5 }}>{description}</div>}
    </div>
    <div style={{ flexShrink: 0 }}>{children}</div>
  </div>
);

export const FieldGroup = ({ label, hint, span, children }: PropsWithChildren<{ label: ReactNode; hint?: ReactNode; span?: boolean }>) => (
  <div style={span ? { gridColumn: '1 / -1' } : undefined}>
    <label style={{ display: 'block', fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 5 }}>
      {label}
      {hint && <span style={{ marginLeft: 6, color: 'var(--ui-text-3)' }}>({hint})</span>}
    </label>
    {children}
  </div>
);

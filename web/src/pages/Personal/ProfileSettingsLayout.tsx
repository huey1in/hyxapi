import type { PropsWithChildren, ReactNode } from 'react';

export const SettingGroup = ({ title, children }: PropsWithChildren<{ title: ReactNode }>) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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

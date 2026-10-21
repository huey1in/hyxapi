export const PERSONAL_SETTINGS_TABS = [
  { value: 'account', label: 'Account & preferences' },
  { value: 'security', label: 'Security' },
  { value: 'usage', label: 'Billing & usage' },
  { value: 'notifications', label: 'Notifications' },
] as const;

export type PersonalSettingsTab = typeof PERSONAL_SETTINGS_TABS[number]['value'];

export function personalSettingsTab(search: string): PersonalSettingsTab {
  const requested = new URLSearchParams(search).get('tab');
  if (requested === 'developer') return 'security';
  return PERSONAL_SETTINGS_TABS.find((tab) => tab.value === requested)?.value ?? 'account';
}

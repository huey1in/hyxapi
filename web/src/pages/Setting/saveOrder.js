const SAVE_LAST_KEYS = new Set(['usdt.enabled', 'EpayEnabled', 'WaffoEnabled', 'AlipayEnabled', 'TelegramOAuthEnabled', 'GitHubOAuthEnabled', 'LinuxDOOAuthEnabled', 'WeChatAuthEnabled', 'discord.enabled', 'oidc.enabled', 'google.enabled', 'passkey.enabled', 'checkin_setting.enabled', 'payment_setting.invitation_rewards_enabled']);

export const orderSettingKeysForSave = (keys) =>
  [...keys].sort((a, b) => Number(SAVE_LAST_KEYS.has(a)) - Number(SAVE_LAST_KEYS.has(b)));

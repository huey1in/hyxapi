const SAVE_LAST_KEYS = new Set(['AlipayEnabled']);

export const orderSettingKeysForSave = (keys) =>
  [...keys].sort((a, b) => Number(SAVE_LAST_KEYS.has(a)) - Number(SAVE_LAST_KEYS.has(b)));

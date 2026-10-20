// Remove local data left by retired pages, including data for other accounts.
export function clearRetiredFeatureStorage(storage: Storage): void {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key && /^playground_(config|messages|parameter_enabled)(:\d+)?$/.test(key)) keys.push(key);
  }
  keys.forEach((key) => storage.removeItem(key));
}

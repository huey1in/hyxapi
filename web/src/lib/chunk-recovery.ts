const RELOAD_KEY = 'hyxware:chunk-reload';
const RELOAD_INTERVAL = 60_000;

export function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { name?: unknown; code?: unknown; message?: unknown };
  return value.name === 'ChunkLoadError' || value.code === 'CSS_CHUNK_LOAD_FAILED' || (
    typeof value.message === 'string' && /Loading (?:CSS )?chunk \S+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(value.message)
  );
}

export function recoverChunkLoad(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  reload: () => void,
  now = Date.now(),
): boolean {
  try {
    const previous = storage.getItem(RELOAD_KEY);
    if (previous !== null && now - Number(previous) < RELOAD_INTERVAL) return false;
    // Persist before reloading so an unavailable asset cannot cause a reload loop.
    storage.setItem(RELOAD_KEY, String(now));
    reload();
    return true;
  } catch {
    return false;
  }
}

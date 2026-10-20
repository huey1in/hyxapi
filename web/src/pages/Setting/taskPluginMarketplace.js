// Marketplace downloads use the source's origin and never carry dashboard credentials.
export function resolvePluginSourceUrl(indexUrl, path) {
  try {
    const base = new URL(indexUrl);
    const resolved = new URL(path, base);
    if (
      !path.trim() ||
      !['http:', 'https:'].includes(resolved.protocol) ||
      resolved.origin !== base.origin ||
      resolved.username ||
      resolved.password
    )
      return null;
    return resolved.href;
  } catch {
    return null;
  }
}

export function parseMarketplaceIndex(payload) {
  if (
    !payload ||
    payload.indexVersion !== 1 ||
    !Array.isArray(payload.plugins)
  ) {
    throw new Error('不支持的插件市场索引，要求 indexVersion: 1');
  }
  return payload.plugins
    .flatMap((entry) => {
      if (!entry || typeof entry.key !== 'string' || !entry.key.trim())
        return [];
      const versions = (
        Array.isArray(entry.versions) ? entry.versions : []
      ).filter(
        (version) =>
          version &&
          typeof version.version === 'string' &&
          version.version.trim() &&
          typeof version.path === 'string' &&
          version.path.trim() &&
          (!version.kind || version.kind === 'task'),
      );
      if (!versions.length) return [];
      return [
        {
          key: entry.key.trim(),
          name: typeof entry.name === 'string' ? entry.name : entry.key,
          description:
            typeof entry.description === 'string'
              ? entry.description
              : entry.description?.zh ||
                entry.description?.['zh-CN'] ||
                entry.description?.en ||
                '',
          versions,
          latest: versions.some((version) => version.version === entry.latest)
            ? entry.latest
            : versions[0].version,
          sortPriority: Number.isInteger(entry.sortPriority)
            ? entry.sortPriority
            : 0,
          iconFile:
            entry.iconFile && /\.(svg|png)$/i.test(entry.iconFile.path || '')
              ? entry.iconFile
              : undefined,
        },
      ];
    })
    .sort(
      (a, b) => b.sortPriority - a.sortPriority || a.key.localeCompare(b.key),
    );
}

export class MarketplaceHTTPError extends Error {
  constructor(status) {
    super('Plugin download failed');
    this.status = status;
  }
}

export async function fetchMarketplaceArtifact(
  indexUrl,
  path,
  sha256,
  fetcher = fetch,
  decodeText = true,
  ownerSignal,
) {
  const url = resolvePluginSourceUrl(indexUrl, path);
  if (!url) throw new Error('插件文件必须位于市场索引的同一来源');
  if (sha256 && !/^[a-f\d]{64}$/i.test(sha256))
    throw new Error('市场提供的 SHA-256 格式无效');
  const signal = ownerSignal
    ? AbortSignal.any([ownerSignal, AbortSignal.timeout(15000)])
    : AbortSignal.timeout(15000);
  signal.throwIfAborted();
  const response = await fetcher(url, {
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal,
  });
  if (!response.ok) throw new MarketplaceHTTPError(response.status);
  if (response.url && !resolvePluginSourceUrl(indexUrl, response.url))
    throw new Error('插件文件重定向到了其他来源');
  const bytes = new Uint8Array(await response.arrayBuffer());
  signal.throwIfAborted();
  if (bytes.byteLength > 8 * 1024 * 1024) throw new Error('插件文件超过 8 MiB');
  const digest = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    (value) => value.toString(16).padStart(2, '0'),
  ).join('');
  signal.throwIfAborted();
  if (sha256 && digest !== sha256.toLowerCase())
    throw new Error('插件文件 SHA-256 校验失败');
  return {
    bytes,
    sha256: digest,
    source: decodeText
      ? new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
      : undefined,
  };
}

export async function loadMarketplaceIndex(
  indexUrl,
  fetcher = fetch,
  ownerSignal,
) {
  const { source } = await fetchMarketplaceArtifact(
    indexUrl,
    indexUrl,
    undefined,
    fetcher,
    true,
    ownerSignal,
  );
  return parseMarketplaceIndex(JSON.parse(source));
}

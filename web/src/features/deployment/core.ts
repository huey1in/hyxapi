export type Draft = { name: string; hardware: string; gpus: string; replicas: string; hours: string; locations: number[]; image: string; port: string; environment: string; secrets: string; entrypoint: string; args: string; username: string; registrySecret: string };
export const initialDraft: Draft = { name: '', hardware: '', gpus: '1', replicas: '1', hours: '1', locations: [], image: '', port: '8000', environment: '{}', secrets: '{}', entrypoint: '[]', args: '[]', username: '', registrySecret: '' };
export function integer(value: string, label: string, min = 1, max = Number.MAX_SAFE_INTEGER): number {
  if (!/^\d+$/.test(value.trim()) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max) throw new Error(`${label}必须是 ${min} 至 ${max} 的整数`);
  return Number(value);
}
export function stringMap(text: string, label: string): Record<string, string> {
  let value: unknown;
  try { value = JSON.parse(text || '{}'); } catch { throw new Error(`${label}必须是有效 JSON 对象`); }
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.values(value).some((item) => typeof item !== 'string')) throw new Error(`${label}的键和值必须是字符串`);
  return value as Record<string, string>;
}
export function strings(text: string, label: string): string[] {
  let value: unknown;
  try { value = JSON.parse(text || '[]'); } catch { throw new Error(`${label}必须是有效 JSON 数组`); }
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) throw new Error(`${label}必须是字符串数组`);
  return value;
}
export function payload(draft: Draft) {
  if (!draft.name.trim() || !draft.image.trim()) throw new Error('请填写部署名称和镜像地址');
  if (!draft.locations.length || draft.locations.some((id) => !Number.isSafeInteger(id) || id < 1) || new Set(draft.locations).size !== draft.locations.length) throw new Error('请选择有效且不重复的部署地区');
  return {
    resource_private_name: draft.name.trim(), hardware_id: integer(draft.hardware, '硬件'),
    gpus_per_container: integer(draft.gpus, '每容器 GPU 数量'), duration_hours: integer(draft.hours, '运行时长'), location_ids: [...draft.locations],
    container_config: { replica_count: integer(draft.replicas, '副本数'), traffic_port: integer(draft.port, '流量端口', 0, 65535), env_variables: stringMap(draft.environment, '环境变量'), secret_env_variables: stringMap(draft.secrets, '机密环境变量'), entrypoint: strings(draft.entrypoint, '启动入口'), args: strings(draft.args, '启动参数') },
    registry_config: { image_url: draft.image.trim(), registry_username: draft.username, registry_secret: draft.registrySecret },
  };
}
export type Payload = ReturnType<typeof payload>;
export function priceInput(value: Payload) {
  return { location_ids: value.location_ids, hardware_id: value.hardware_id, gpus_per_container: value.gpus_per_container, duration_hours: value.duration_hours, replica_count: value.container_config.replica_count, currency: 'usdc' };
}
export function safePublicURL(value: string): string | undefined {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined; } catch { return undefined; }
}
export function updateConfiguration(text: string): Record<string, unknown> {
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('更新配置必须是 JSON 对象');
  const fields = value as Record<string, unknown>;
  const textFields = ['image_url', 'registry_username', 'registry_secret', 'command'];
  for (const key of Object.keys(fields)) {
    if (['env_variables', 'secret_env_variables'].includes(key)) stringMap(JSON.stringify(fields[key]), key);
    else if (['entrypoint', 'args'].includes(key)) strings(JSON.stringify(fields[key]), key);
    else if (key === 'traffic_port') {
      if (typeof fields[key] !== 'number') throw new Error('traffic_port 必须是数字');
      integer(String(fields[key]), 'traffic_port', 0, 65535);
    } else if (!textFields.includes(key) || typeof fields[key] !== 'string') throw new Error(`不支持的配置字段或类型：${key}`);
  }
  if (!Object.keys(fields).length) throw new Error('请至少填写一个更新字段');
  return fields;
}

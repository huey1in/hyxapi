import { z } from 'zod';

const progressSchema = z.object({ status: z.string().optional(), digest: z.string().optional(), total: z.number().finite().nonnegative().optional(), completed: z.number().finite().nonnegative().optional(), error: z.string().optional(), message: z.string().optional() });
export type OllamaProgress = z.infer<typeof progressSchema>;

export function downloadPercent(progress?: OllamaProgress): number | undefined {
  if (!progress || progress.total === undefined || progress.total <= 0 || progress.completed === undefined) return;
  return Math.max(0, Math.min(100, progress.completed / progress.total * 100));
}

export async function readOllamaProgress(response: Response, signal: AbortSignal, onProgress: (progress: OllamaProgress) => void): Promise<void> {
  if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) {
    const data: unknown = await response.json().catch(() => undefined);
    const message = data && typeof data === 'object' && 'message' in data && typeof data.message === 'string' ? data.message : 'Unable to start model download';
    throw new Error(message);
  }
  if (!response.body) throw new Error('No download progress stream');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let data: string[] = [];
  let dataLength = 0;
  let done = false;
  let successful = false;
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  const dispatch = () => {
    if (!data.length) return;
    const payload = data.join('\n'); data = []; dataLength = 0;
    if (payload === '[DONE]') { done = true; return; }
    let value: unknown;
    try { value = JSON.parse(payload); } catch { throw new Error('Invalid download progress'); }
    const parsed = progressSchema.safeParse(value);
    if (!parsed.success) throw new Error('Invalid download progress');
    if (parsed.data.error) throw new Error(parsed.data.error);
    if (parsed.data.status?.toLowerCase() === 'success') successful = true;
    if (parsed.data.status?.toLowerCase() === 'error') throw new Error('Model download failed');
    if (parsed.data.status) onProgress(parsed.data);
  };
  const line = (value: string) => {
    if (!value) { dispatch(); return; }
    if (value.startsWith('data:')) {
      const part = value.slice(5).trimStart();
      dataLength += part.length;
      if (dataLength > 2 * 1024 * 1024) throw new Error('Download progress exceeds size limit');
      data.push(part);
    }
  };
  try {
    while (!done) {
      signal.throwIfAborted();
      const chunk = await reader.read();
      signal.throwIfAborted();
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      if (buffer.length > 2 * 1024 * 1024) throw new Error('Download progress exceeds size limit');
      let boundary: number;
      while (!done && (boundary = buffer.indexOf('\n')) >= 0) {
        const value = buffer.slice(0, boundary).replace(/\r$/, ''); buffer = buffer.slice(boundary + 1); line(value);
      }
      if (chunk.done) { if (buffer) line(buffer.replace(/\r$/, '')); dispatch(); break; }
    }
    if (!done || !successful) throw new Error('Model download did not complete');
  } finally {
    signal.removeEventListener('abort', abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

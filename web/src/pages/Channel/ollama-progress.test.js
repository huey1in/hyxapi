import test from 'node:test';
import assert from 'node:assert/strict';
import { downloadPercent, readOllamaProgress } from './ollama-progress.ts';

function response(chunks) {
  const bytes = new TextEncoder().encode(chunks);
  return new Response(new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(Uint8Array.of(byte)); controller.close(); } }), { headers: { 'Content-Type': 'text/event-stream' } });
}

test('Ollama progress preserves split UTF-8 and requires terminal success', async () => {
  const seen = [];
  await readOllamaProgress(response('data: {"status":"下载","completed":0,"total":10}\r\n\r\ndata: {"status":"success"}\n\ndata: [DONE]\n\n'), new AbortController().signal, (value) => seen.push(value));
  assert.equal(seen[0].status, '下载');
  assert.equal(downloadPercent(seen[0]), 0);
  assert.equal(downloadPercent({ completed: 20, total: 10 }), 100);
  assert.equal(downloadPercent({ completed: 0, total: 0 }), undefined);
  for (const body of ['data: [DONE]\n\n', 'data: {"status":"success"}\n\n', 'data: {"error":"download denied"}\n\n', 'data: {bad}\n\n']) {
    await assert.rejects(readOllamaProgress(response(body), new AbortController().signal, () => {}));
  }
});

test('canceling Ollama progress closes a stalled body without reporting completion', async () => {
  let canceled = false;
  const controller = new AbortController();
  const stream = new ReadableStream({ cancel() { canceled = true; } });
  const pending = readOllamaProgress(new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }), controller.signal, () => {});
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(canceled, true);
});

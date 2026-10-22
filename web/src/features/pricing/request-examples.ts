export type ExampleLanguage = 'curl' | 'python' | 'typescript' | 'javascript';
export interface EndpointInfo { path: string; method: string }
interface ModelRequest { url: string; method: string; headers: Record<string, string>; body?: Record<string, unknown> }

export function buildModelRequest(model: string, endpoint: string, info: EndpointInfo | undefined, origin: string): ModelRequest | null {
  if (!info || !info.path.startsWith('/') || info.path.startsWith('//') || /[\s\\\x00-\x1f\x7f]/.test(info.path)) return null;
  const message = 'Hello';
  let body: Record<string, unknown>;
  switch (endpoint) {
    case 'openai': body = { model, messages: [{ role: 'user', content: message }] }; break;
    case 'openai-response': body = { model, input: message }; break;
    case 'openai-response-compact': body = { model, input: [{ role: 'user', content: message }] }; break;
    case 'anthropic': body = { model, max_tokens: 1024, messages: [{ role: 'user', content: message }] }; break;
    case 'gemini': body = { contents: [{ role: 'user', parts: [{ text: message }] }] }; break;
    case 'embeddings': body = { model, input: message }; break;
    case 'image-generation': body = { model, prompt: 'A quiet garden', n: 1 }; break;
    case 'jina-rerank': body = { model, query: message, documents: ['Hello world', 'A quiet garden'] }; break;
    default: return null;
  }
  const method = info.method.toUpperCase();
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(method)) return null;
  const base = new URL(origin).origin;
  const path = info.path.replaceAll('{model}', encodeURIComponent(model));
  const url = new URL(path, base);
  if (url.origin !== base) return null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (endpoint === 'anthropic') headers['anthropic-version'] = '2023-06-01';
  return { url: url.href, method, headers, ...(method !== 'GET' && method !== 'HEAD' ? { body } : {}) };
}

const shellQuote = (value: string) => `'${value.replaceAll("'", "'\"'\"'")}'`;

export function renderModelRequest(request: ModelRequest, language: ExampleLanguage): string {
  if (language === 'curl') return [
    `curl --request ${request.method} ${shellQuote(request.url)}`,
    '  --header "Authorization: Bearer $HYXAPI_API_KEY"',
    ...Object.entries(request.headers).map(([name, value]) => `  --header ${shellQuote(`${name}: ${value}`)}`),
    ...(request.body ? [`  --data-raw ${shellQuote(JSON.stringify(request.body, null, 2))}`] : []),
  ].join(' \\\n');
  if (language === 'python') return [
    'import json', 'import os', 'from urllib.request import Request, urlopen', '',
    ...(request.body ? [`body = json.loads(${JSON.stringify(JSON.stringify(request.body))})`] : []),
    `headers = ${JSON.stringify(request.headers)}`,
    'headers["Authorization"] = "Bearer " + os.environ["HYXAPI_API_KEY"]',
    `request = Request(${JSON.stringify(request.url)}, method=${JSON.stringify(request.method)}, headers=headers${request.body ? ', data=json.dumps(body).encode("utf-8")' : ''})`,
    'with urlopen(request) as response:', '    print(json.load(response))',
  ].join('\n');
  return [
    `const response = await fetch(${JSON.stringify(request.url)}, {`,
    `  method: ${JSON.stringify(request.method)},`,
    '  headers: {', '    Authorization: `Bearer ${process.env.HYXAPI_API_KEY}`,',
    ...Object.entries(request.headers).map(([name, value]) => `    ${JSON.stringify(name)}: ${JSON.stringify(value)},`),
    '  },', ...(request.body ? [`  body: JSON.stringify(${JSON.stringify(request.body, null, 2)}),`] : []),
    '});', 'console.log(await response.json());',
  ].join('\n');
}

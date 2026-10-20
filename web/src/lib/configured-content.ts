export function configuredContentKind(content: string): 'empty' | 'url' | 'html' | 'markdown' {
  const value = content.trim();
  if (!value) return 'empty';
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') return 'url';
  } catch { /* Non-URL content is rendered below. */ }
  // A Markdown document can contain code samples or inline tags. Only a
  // document beginning with HTML uses the isolated HTML renderer.
  if (/^(?:<!--[\s\S]*?-->\s*)*<(?:!doctype\s+html|[a-z][a-z\d-]*(?:\s|>))/i.test(value)) return 'html';
  return 'markdown';
}

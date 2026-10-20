import Prism from 'prismjs';
import 'prismjs/components/prism-jsx.js';
import 'prismjs/components/prism-typescript.js';
import 'prismjs/components/prism-tsx.js';
import 'prismjs/components/prism-json.js';
import 'prismjs/components/prism-bash.js';
import 'prismjs/components/prism-css.js';
import 'prismjs/components/prism-markdown.js';

const escapeHTML = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export function highlightCode(code: string, language?: string, sensitiveText?: string, revealSensitive = false): string {
  const grammar = language ? Prism.languages[language] : undefined;
  const highlighted = grammar ? Prism.highlight(code, grammar, language!) : escapeHTML(code);
  if (!sensitiveText || revealSensitive || sensitiveText.length <= 11) return highlighted;
  return highlighted.replaceAll(escapeHTML(sensitiveText),
    `${escapeHTML(sensitiveText.slice(0, 7))}<span class="blur-[4px] transition-[filter] duration-200">${escapeHTML(sensitiveText.slice(7, -4))}</span>${escapeHTML(sensitiveText.slice(-4))}`);
}

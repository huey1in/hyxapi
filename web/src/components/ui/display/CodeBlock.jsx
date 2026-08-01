/*
 * CodeBlock — 等宽代码块（Menlo + Prism 高亮 + 顶部条 + 复制）
 *
 * 顶栏：左侧语言图标/标签，右侧复制按钮。
 *
 * code:      string
 * language:  Prism 语言 key（jsx/tsx/ts/json/bash/css/markdown/javascript/python）
 * title:     代替语言名展示在顶栏（可选）
 * showLineNumbers
 * maxHeight  滚动
 * inline     行内代码
 */

import React, { useState, useMemo } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '../tokens';
import { copy as copyText } from '../../../helpers';
import Prism from 'prismjs';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markdown';
import './codeblock-theme.css';

const ICON_BASE = 'https://registry.npmmirror.com/@lobehub/assets-fileicon/1.0.0/files/assets';
const LANG_META = {
  jsx:        { label: 'JSX',        icon: 'jsx.svg'        },
  tsx:        { label: 'TSX',        icon: 'tsx.svg'        },
  js:         { label: 'JavaScript', icon: 'javascript.svg' },
  javascript: { label: 'JavaScript', icon: 'javascript.svg' },
  ts:         { label: 'TypeScript', icon: 'typescript.svg' },
  typescript: { label: 'TypeScript', icon: 'typescript.svg' },
  json:       { label: 'JSON',       icon: 'json.svg'       },
  bash:       { label: 'Shell',      icon: 'console.svg'    },
  shell:      { label: 'Shell',      icon: 'console.svg'    },
  sh:         { label: 'Shell',      icon: 'console.svg'    },
  css:        { label: 'CSS',        icon: 'css.svg'        },
  markdown:   { label: 'Markdown',   icon: 'markdown.svg'   },
  md:         { label: 'Markdown',   icon: 'markdown.svg'   },
  python:     { label: 'Python',     icon: 'python.svg'     },
  py:         { label: 'Python',     icon: 'python.svg'     },
  html:       { label: 'HTML',       icon: 'html.svg'       },
  yaml:       { label: 'YAML',       icon: 'yaml.svg'       },
  yml:        { label: 'YAML',       icon: 'yaml.svg'       },
  sql:        { label: 'SQL',        icon: 'sql.svg'        },
  go:         { label: 'Go',         icon: 'go.svg'         },
  rust:       { label: 'Rust',       icon: 'rust.svg'       },
};

const Inline = ({ children }) => (
  <code className='inline px-1.5 py-0.5 rounded bg-ui-bg-subtle text-ui-text font-mono text-[0.85em]'>
    {children}
  </code>
);

const highlight = (code, language) => {
  if (!language) return code;
  const grammar = Prism.languages[language];
  if (!grammar) return code;
  return Prism.highlight(code, grammar, language);
};

const CodeBlock = ({
  code = '',
  copyText: copyContent,
  onContentClick,
  sensitiveText,
  revealSensitive = false,
  language,
  title,
  showLineNumbers = false,
  maxHeight,
  inline = false,
  children,
}) => {
  const content = String(code || children || '');
  const [copied, setCopied] = useState(false);

  const html = useMemo(() => {
    const highlighted = highlight(content, language);
    if (!sensitiveText || revealSensitive) return highlighted;
    const visibleStart = sensitiveText.slice(0, 7);
    const visibleEnd = sensitiveText.slice(-4);
    const blurredMiddle = sensitiveText.slice(7, -4);
    if (!blurredMiddle) return highlighted;
    return highlighted.replaceAll(
      sensitiveText,
      `${visibleStart}<span class="blur-[4px] transition-[filter] duration-200">${blurredMiddle}</span>${visibleEnd}`,
    );
  }, [content, language, revealSensitive, sensitiveText]);
  const isHighlighted = html !== content;

  if (inline) return <Inline>{content}</Inline>;

  const copy = async () => {
    const ok = await copyText(copyContent ?? content);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const lines = content.split('\n');
  const meta = LANG_META[language] || { label: language || 'Text', icon: 'document.svg' };

  return (
    <div className='rounded-xl overflow-hidden' style={{ backgroundColor: 'var(--ui-code-bg)' }}>
      <div className='flex items-center gap-2 px-3 py-1.5 text-xs select-none'>
        <img src={`${ICON_BASE}/${meta.icon}`} alt='' width={16} height={16} className='flex-shrink-0' />
        <span className='text-ui-text-2 truncate flex-1'>{title || meta.label}</span>
        <button
          type='button'
          onClick={copy}
          className='inline-flex items-center justify-center w-6 h-6 rounded-md text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle transition'
          aria-label='copy'
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <pre
        onClick={onContentClick}
        className={cn(
          'px-4 py-3 overflow-auto text-[12.5px] leading-relaxed font-mono text-ui-text',
          `language-${language || 'text'}`,
          onContentClick && 'cursor-pointer select-none',
        )}
        style={maxHeight ? { maxHeight } : undefined}
      >
        {showLineNumbers ? (
          <code className={cn('block', `language-${language || 'text'}`)}>
            {lines.map((ln, i) => {
              const renderedLine = isHighlighted ? highlight(ln || ' ', language) : (ln || ' ');
              return (
                <span key={i} className='flex'>
                  <span className='select-none mr-4 w-6 text-right text-ui-text-3 tabular-nums flex-shrink-0'>{i + 1}</span>
                  <span className='flex-1' dangerouslySetInnerHTML={{ __html: renderedLine }} />
                </span>
              );
            })}
          </code>
        ) : (
          <code className={`language-${language || 'text'}`} dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </pre>
    </div>
  );
};

CodeBlock.Inline = Inline;
export default CodeBlock;

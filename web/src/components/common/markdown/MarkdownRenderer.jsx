/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import ReactMarkdown from 'react-markdown';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/atom-one-dark.css';
import './markdown.css';
import RemarkMath from 'remark-math';
import RemarkBreaks from 'remark-breaks';
import RehypeKatex from 'rehype-katex';
import RemarkGfm from 'remark-gfm';
import RehypeHighlight from 'rehype-highlight';
import { useState, useMemo } from 'react';
import React from 'react';
import clsx from 'clsx';
import { Check, Copy } from 'lucide-react';
import { copy, rehypeSplitWordsIntoSpans } from '../../../helpers';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui';

// Wrap-friendly languages — let lines break inside the code block.
const WRAP_LANGUAGES = new Set([
  '',
  'md',
  'markdown',
  'text',
  'txt',
  'plaintext',
  'tex',
  'latex',
]);

// Friendly display names for common languages.
const LANG_DISPLAY = {
  js: 'JavaScript',
  jsx: 'JSX',
  ts: 'TypeScript',
  tsx: 'TSX',
  py: 'Python',
  go: 'Go',
  rs: 'Rust',
  java: 'Java',
  kt: 'Kotlin',
  c: 'C',
  cpp: 'C++',
  cs: 'C#',
  rb: 'Ruby',
  php: 'PHP',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  toml: 'TOML',
  xml: 'XML',
  md: 'Markdown',
  markdown: 'Markdown',
  sh: 'Shell',
  bash: 'Bash',
  zsh: 'Zsh',
  sql: 'SQL',
  graphql: 'GraphQL',
  dockerfile: 'Dockerfile',
};

const getLangFromChildren = (children) => {
  // ReactMarkdown renders <pre><code class="language-xxx">…</code></pre>
  const child = React.Children.toArray(children).find(
    (c) => React.isValidElement(c) && c.props?.className,
  );
  if (!child) return '';
  const m = String(child.props.className || '').match(/language-([\w-]+)/);
  return m ? m[1].toLowerCase() : '';
};

const getCodeText = (children) => {
  let out = '';
  React.Children.forEach(children, (c) => {
    if (typeof c === 'string') out += c;
    else if (typeof c === 'number') out += String(c);
    else if (React.isValidElement(c)) out += getCodeText(c.props.children);
  });
  return out;
};

function PreCode({ children, ...rest }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const lang = getLangFromChildren(children);
  const display = LANG_DISPLAY[lang] || (lang ? lang : 'plain');
  const wrap = WRAP_LANGUAGES.has(lang);

  const handleCopy = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const text = getCodeText(children);
    const ok = await copy(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <div className='code-block'>
      <div className='code-block-header'>
        <span className='code-block-lang'>{display}</span>
        <Button
          variant='ghost'
          size='sm'
          onClick={handleCopy}
          icon={copied ? Check : Copy}
          aria-label={t('复制代码')}
          className='code-block-copy'
        >
          {copied ? t('已复制') : t('复制')}
        </Button>
      </div>
      <pre
        {...rest}
        className={clsx('code-block-pre', wrap && 'code-block-wrap')}
      >
        {children}
      </pre>
    </div>
  );
}

function CustomCode(props) {
  // Inline code (no parent <pre>) gets a subtle pill style.
  // Block code is handled by PreCode wrapper above; just render the <code> as-is so highlight.js can colorize it.
  const { className, children, ...rest } = props;
  const isBlock = /language-/.test(className || '');
  if (isBlock) {
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    );
  }
  return (
    <code {...rest} className={clsx('inline-code', className)}>
      {children}
    </code>
  );
}

function escapeBrackets(text) {
  const pattern =
    /(```[\s\S]*?```|`.*?`)|\\\[([\s\S]*?[^\\])\\\]|\\\((.*?)\\\)/g;
  return text.replace(
    pattern,
    (match, codeBlock, squareBracket, roundBracket) => {
      if (codeBlock) {
        return codeBlock;
      } else if (squareBracket) {
        return `$$${squareBracket}$$`;
      } else if (roundBracket) {
        return `$${roundBracket}$`;
      }
      return match;
    },
  );
}

// 把没用代码栅栏包裹的 HTML / XML / SVG 文档（包括 LLM 工具调用风格的多行块）
// 自动包成 ```html 代码块，避免被 markdown 当作 inline HTML 解析后被空行切碎。
//
// 对于 LLM 工具调用包装（如 <write_to_file>），会智能识别 <path> 扩展名，
// 把 <content> 内部按合适的语言渲染（.md 直接当 markdown，.html/.svg 用 html 高亮等）。
function autoFenceRawDocs(text) {
  if (!text) return text;

  const EXT_TO_LANG = {
    md: 'markdown',
    markdown: 'markdown',
    html: 'html',
    htm: 'html',
    xml: 'xml',
    svg: 'html',
    js: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    c: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    sql: 'sql',
    graphql: 'graphql',
    gql: 'graphql',
    dockerfile: 'dockerfile',
    vue: 'html',
    svelte: 'html',
  };

  const TOOL_WRAPPER_RE =
    /<([a-z][a-z0-9]*(?:_[a-z0-9]+)+)\b[^>]*>\s*\n([\s\S]*?)\n\s*<\/\1\s*>/i;
  const HTML_DOC_RE = /<!DOCTYPE\s+html[\s\S]*?<\/html\s*>/i;
  const XML_DOC_RE = /<\?xml[\s\S]*?<\/[\w:-]+\s*>/i;
  const SVG_RE = /<svg\b[\s\S]*?<\/svg\s*>/i;

  // 已存在的代码栅栏 / 行内代码识别
  const codeFence = /(```[\s\S]*?```|`[^`]*`)/;

  // 从工具调用 wrapper 内部抽取 <path>...</path> 和 <content>...</content>
  // 然后用 path 的扩展名决定渲染方式。如果不能识别，整段当 text 代码块。
  const transformToolWrapper = (block, _tagName, inner) => {
    const pathMatch = inner.match(/<path>\s*([^<]+?)\s*<\/path>/i);
    const contentMatch = inner.match(/<content>\s*\n([\s\S]*?)\n\s*<\/content>/i);
    if (contentMatch) {
      const innerContent = contentMatch[1];
      let lang = 'text';
      if (pathMatch) {
        const pathStr = pathMatch[1].trim();
        const dot = pathStr.lastIndexOf('.');
        if (dot >= 0) {
          const ext = pathStr.slice(dot + 1).toLowerCase();
          lang = EXT_TO_LANG[ext] || ext || 'text';
        }
      }
      // markdown 文件直接还原为 markdown 文本，让外层渲染器去处理
      if (lang === 'markdown') {
        return `\n${innerContent}\n`;
      }
      return `\n\`\`\`${lang}\n${innerContent}\n\`\`\`\n`;
    }
    // 没有 <content>，整段保留作为代码块
    return `\n\`\`\`text\n${block}\n\`\`\`\n`;
  };

  let out = '';
  let rest = text;
  while (rest.length > 0) {
    // 找最近的代码栅栏
    const fenceMatch = codeFence.exec(rest);
    const fenceIdx = fenceMatch ? fenceMatch.index : -1;

    // 找最近的裸文档块
    const candidates = [
      { re: TOOL_WRAPPER_RE, kind: 'tool' },
      { re: HTML_DOC_RE, kind: 'html' },
      { re: XML_DOC_RE, kind: 'html' },
      { re: SVG_RE, kind: 'html' },
    ];
    let docIdx = -1;
    let docMatch = null;
    let docKind = null;
    for (const { re, kind } of candidates) {
      const m = re.exec(rest);
      if (m && (docIdx < 0 || m.index < docIdx)) {
        docIdx = m.index;
        docMatch = m;
        docKind = kind;
      }
    }

    // 代码栅栏在裸文档块之前（或后者不存在），先吃掉栅栏
    if (fenceIdx >= 0 && (docIdx < 0 || fenceIdx <= docIdx)) {
      out += rest.slice(0, fenceIdx + fenceMatch[0].length);
      rest = rest.slice(fenceIdx + fenceMatch[0].length);
      continue;
    }

    if (docMatch) {
      out += rest.slice(0, docIdx);
      if (docKind === 'tool') {
        out += transformToolWrapper(docMatch[0], docMatch[1], docMatch[2]);
      } else {
        out += `\n\`\`\`html\n${docMatch[0]}\n\`\`\`\n`;
      }
      rest = rest.slice(docIdx + docMatch[0].length);
      continue;
    }

    out += rest;
    break;
  }
  return out;
}

function _MarkdownContent(props) {
  const {
    content,
    className,
    animated = false,
    previousContentLength = 0,
  } = props;

  const escapedContent = useMemo(() => {
    return escapeBrackets(autoFenceRawDocs(content));
  }, [content]);

  // 判断是否为用户消息
  const isUserMessage = className && className.includes('user-message');

  const rehypePluginsBase = useMemo(() => {
    const base = [
      RehypeKatex,
      [
        RehypeHighlight,
        {
          detect: false,
          ignoreMissing: true,
        },
      ],
    ];
    if (animated) {
      base.push([rehypeSplitWordsIntoSpans, { previousContentLength }]);
    }
    return base;
  }, [animated, previousContentLength]);

  return (
    <ReactMarkdown
      remarkPlugins={[RemarkMath, RemarkGfm, RemarkBreaks]}
      rehypePlugins={rehypePluginsBase}
      components={{
        pre: PreCode,
        code: CustomCode,
        p: (pProps) => (
          <p
            {...pProps}
            dir='auto'
            style={{
              lineHeight: '1.6',
              color: isUserMessage ? 'white' : 'inherit',
            }}
          />
        ),
        a: (aProps) => {
          const href = aProps.href || '';
          if (/\.(aac|mp3|opus|wav)$/.test(href)) {
            return (
              <figure style={{ margin: '12px 0' }}>
                <audio controls src={href} style={{ width: '100%' }}></audio>
              </figure>
            );
          }
          if (/\.(3gp|3g2|webm|ogv|mpeg|mp4|avi)$/.test(href)) {
            return (
              <video
                controls
                style={{ width: '100%', maxWidth: '100%', margin: '12px 0' }}
              >
                <source src={href} />
              </video>
            );
          }
          const isInternal = /^\/#/i.test(href);
          const target = isInternal ? '_self' : (aProps.target ?? '_blank');
          return (
            <a
              {...aProps}
              target={target}
              style={{
                color: isUserMessage ? '#87CEEB' : 'var(--semi-color-primary)',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => {
                e.target.style.textDecoration = 'underline';
              }}
              onMouseLeave={(e) => {
                e.target.style.textDecoration = 'none';
              }}
            />
          );
        },
        h1: (props) => (
          <h1
            {...props}
            style={{
              fontSize: '24px',
              fontWeight: 'bold',
              margin: '20px 0 12px 0',
              color: isUserMessage ? 'white' : 'var(--semi-color-text-0)',
            }}
          />
        ),
        h2: (props) => (
          <h2
            {...props}
            style={{
              fontSize: '20px',
              fontWeight: 'bold',
              margin: '18px 0 10px 0',
              color: isUserMessage ? 'white' : 'var(--semi-color-text-0)',
            }}
          />
        ),
        h3: (props) => (
          <h3
            {...props}
            style={{
              fontSize: '18px',
              fontWeight: 'bold',
              margin: '16px 0 8px 0',
              color: isUserMessage ? 'white' : 'var(--semi-color-text-0)',
            }}
          />
        ),
        h4: (props) => (
          <h4
            {...props}
            style={{
              fontSize: '16px',
              fontWeight: 'bold',
              margin: '14px 0 6px 0',
              color: isUserMessage ? 'white' : 'var(--semi-color-text-0)',
            }}
          />
        ),
        h5: (props) => (
          <h5
            {...props}
            style={{
              fontSize: '14px',
              fontWeight: 'bold',
              margin: '12px 0 4px 0',
              color: isUserMessage ? 'white' : 'var(--semi-color-text-0)',
            }}
          />
        ),
        h6: (props) => (
          <h6
            {...props}
            style={{
              fontSize: '13px',
              fontWeight: 'bold',
              margin: '10px 0 4px 0',
              color: isUserMessage ? 'white' : 'var(--semi-color-text-0)',
            }}
          />
        ),
        blockquote: (props) => (
          <blockquote
            {...props}
            style={{
              borderLeft: isUserMessage
                ? '4px solid rgba(255, 255, 255, 0.5)'
                : '4px solid var(--semi-color-primary)',
              paddingLeft: '16px',
              margin: '12px 0',
              backgroundColor: isUserMessage
                ? 'rgba(255, 255, 255, 0.1)'
                : 'var(--semi-color-fill-0)',
              padding: '8px 16px',
              borderRadius: '0 4px 4px 0',
              fontStyle: 'italic',
              color: isUserMessage ? 'white' : 'inherit',
            }}
          />
        ),
        ul: (props) => (
          <ul
            {...props}
            style={{
              margin: '8px 0',
              paddingLeft: '20px',
              color: isUserMessage ? 'white' : 'inherit',
            }}
          />
        ),
        ol: (props) => (
          <ol
            {...props}
            style={{
              margin: '8px 0',
              paddingLeft: '20px',
              color: isUserMessage ? 'white' : 'inherit',
            }}
          />
        ),
        li: (props) => (
          <li
            {...props}
            style={{
              margin: '4px 0',
              lineHeight: '1.6',
              color: isUserMessage ? 'white' : 'inherit',
            }}
          />
        ),
        table: (props) => (
          <div style={{ overflow: 'auto', margin: '12px 0' }}>
            <table
              {...props}
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                border: isUserMessage
                  ? '1px solid rgba(255, 255, 255, 0.3)'
                  : '1px solid var(--semi-color-border)',
                borderRadius: '6px',
                overflow: 'hidden',
              }}
            />
          </div>
        ),
        th: (props) => (
          <th
            {...props}
            style={{
              padding: '8px 12px',
              backgroundColor: isUserMessage
                ? 'rgba(255, 255, 255, 0.2)'
                : 'var(--semi-color-fill-1)',
              border: isUserMessage
                ? '1px solid rgba(255, 255, 255, 0.3)'
                : '1px solid var(--semi-color-border)',
              fontWeight: 'bold',
              textAlign: 'left',
              color: isUserMessage ? 'white' : 'inherit',
            }}
          />
        ),
        td: (props) => (
          <td
            {...props}
            style={{
              padding: '8px 12px',
              border: isUserMessage
                ? '1px solid rgba(255, 255, 255, 0.3)'
                : '1px solid var(--semi-color-border)',
              color: isUserMessage ? 'white' : 'inherit',
            }}
          />
        ),
      }}
    >
      {escapedContent}
    </ReactMarkdown>
  );
}

export const MarkdownContent = React.memo(_MarkdownContent);

export function MarkdownRenderer(props) {
  const {
    content,
    loading,
    fontSize = 14,
    fontFamily = 'inherit',
    className,
    style,
    animated = false,
    previousContentLength = 0,
    ...otherProps
  } = props;

  return (
    <div
      className={clsx('markdown-body', className)}
      style={{
        fontSize: `${fontSize}px`,
        fontFamily: fontFamily,
        lineHeight: '1.6',
        color: 'var(--semi-color-text-0)',
        ...style,
      }}
      dir='auto'
      {...otherProps}
    >
      {loading ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '16px',
            color: 'var(--semi-color-text-2)',
          }}
        >
          <div
            style={{
              width: '16px',
              height: '16px',
              border: '2px solid var(--semi-color-border)',
              borderTop: '2px solid var(--semi-color-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          正在渲染...
        </div>
      ) : (
        <MarkdownContent
          content={content}
          className={className}
          animated={animated}
          previousContentLength={previousContentLength}
        />
      )}
    </div>
  );
}

export default MarkdownRenderer;

/*
 * MarkdownRenderer — react-markdown 薄包装
 *
 * - remark-gfm（表格、删除线、列表）
 * - remark-breaks（软换行变 <br>）
 * - 代码块走 ui/CodeBlock 高亮
 * - prose 段落 / 标题 / 链接走 ui-text-* 色板
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import CodeBlock from '../../ui/display/CodeBlock';
import { cn } from '../../ui/tokens';

const components = {
  h1: ({ children }) => <h1 className='text-2xl font-semibold text-ui-text mt-6 mb-3'>{children}</h1>,
  h2: ({ children }) => <h2 className='text-xl font-semibold text-ui-text mt-5 mb-2.5'>{children}</h2>,
  h3: ({ children }) => <h3 className='text-base font-semibold text-ui-text mt-4 mb-2'>{children}</h3>,
  p:  ({ children }) => <p className='text-sm text-ui-text-2 leading-relaxed my-2'>{children}</p>,
  a:  ({ children, href }) => <a href={href} target='_blank' rel='noopener noreferrer' className='text-ui-text underline underline-offset-2 hover:text-ui-text-2'>{children}</a>,
  ul: ({ children }) => <ul className='list-disc pl-6 my-2 space-y-1 text-sm text-ui-text-2'>{children}</ul>,
  ol: ({ children }) => <ol className='list-decimal pl-6 my-2 space-y-1 text-sm text-ui-text-2'>{children}</ol>,
  li: ({ children }) => <li className='leading-relaxed'>{children}</li>,
  hr: () => <div className='my-4 h-px bg-ui-divider' />,
  blockquote: ({ children }) => <blockquote className='border-l-2 border-ui-border pl-3 my-3 text-ui-text-3 italic'>{children}</blockquote>,
  table: ({ children }) => <div className='overflow-x-auto my-3'><table className='w-full text-sm border border-ui-border rounded-xl overflow-hidden'>{children}</table></div>,
  thead: ({ children }) => <thead className='bg-ui-bg-subtle/60'>{children}</thead>,
  th: ({ children }) => <th className='text-left px-3 py-2 font-medium text-ui-text-2 border-b border-ui-border'>{children}</th>,
  td: ({ children }) => <td className='px-3 py-2 border-b border-ui-divider text-ui-text'>{children}</td>,
  code: ({ inline, className, children }) => {
    const lang = /language-(\w+)/.exec(className || '')?.[1];
    const value = String(children).replace(/\n$/, '');
    if (inline) return <CodeBlock.Inline>{value}</CodeBlock.Inline>;
    return <CodeBlock language={lang} code={value} />;
  },
  pre: ({ children }) => <>{children}</>,
};

const MarkdownRenderer = ({ content = '', className }) => (
  <div className={cn('markdown-body', className)}>
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
      {content}
    </ReactMarkdown>
  </div>
);

export default MarkdownRenderer;

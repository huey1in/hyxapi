import CodeBlock from './CodeBlock';

export default { title: 'UI/CodeBlock', component: CodeBlock };

const Row = ({ title, children }) => (
  <div className='mb-5'>
    <div className='text-[11px] uppercase tracking-wider text-ui-text-3 mb-2'>{title}</div>
    {children}
  </div>
);

const sample = `import { Button } from '@/components/ui';

// JSX 示例
export default function Demo({ name }) {
  const onClick = () => alert('hi ' + name);
  return <Button onClick={onClick}>Hello {name}</Button>;
}`;

const jsonSample = `{
  "name": "routify",
  "version": "0.1.0",
  "private": true,
  "scripts": { "build": "vite build" }
}`;

const bashSample = `# 安装依赖并启动
npm install
npm run storybook -- --port 6006`;

export const AllVariants = () => (
  <div className='max-w-[700px] space-y-6'>
    <Row title='jsx 语法高亮'>
      <CodeBlock title='Demo.jsx' language='jsx' code={sample} />
    </Row>
    <Row title='json'>
      <CodeBlock title='package.json' language='json' code={jsonSample} />
    </Row>
    <Row title='bash'>
      <CodeBlock language='bash' code={bashSample} />
    </Row>
    <Row title='显示行号'>
      <CodeBlock title='Demo.jsx' language='jsx' showLineNumbers code={sample} />
    </Row>
    <Row title='maxHeight 滚动'>
      <CodeBlock
        title='long.txt'
        maxHeight={120}
        code={Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join('\n')}
      />
    </Row>
    <Row title='内联代码'>
      <div className='text-sm text-ui-text-2 leading-relaxed'>
        用 <CodeBlock.Inline>npm run build</CodeBlock.Inline> 构建产物，输出到 <CodeBlock.Inline>web/dist</CodeBlock.Inline>。
      </div>
    </Row>
  </div>
);

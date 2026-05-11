import React from 'react';
import '../src/index.css';

/** @type { import('@storybook/react').Preview } */
const preview = {
  parameters: {
    layout: 'padded',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    /* 关闭 Storybook 自带 backgrounds —— 改由主题切换控制 body 背景 */
    backgrounds: { disable: true, grid: { disable: true } },
  },
  globalTypes: {
    theme: {
      description: '主题',
      defaultValue: 'light',
      toolbar: {
        title: '主题',
        icon: 'paintbrush',
        items: [
          { value: 'light', title: '亮色', icon: 'sun' },
          { value: 'dark',  title: '暗色', icon: 'moon' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme || 'light';
      React.useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle('dark', theme === 'dark');
        /* 让 iframe body 跟随主题 */
        document.body.style.backgroundColor = 'var(--page-bg)';
        document.body.style.color = 'var(--ui-text)';
      }, [theme]);
      return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--page-bg)', color: 'var(--ui-text)' }}>
          <Story />
        </div>
      );
    },
  ],
};

export default preview;

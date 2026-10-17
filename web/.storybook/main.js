import { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss';

/** @type { import('storybook-react-rsbuild').StorybookConfig } */
export default {
  stories: ['../src/components/ui/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [],
  staticDirs: ['../public'],
  framework: {
    name: 'storybook-react-rsbuild',
    options: {},
  },
  rsbuildFinal: (config) => ({
    ...config,
    plugins: [...(config.plugins || []), pluginTailwindcss()],
    tools: {
      ...config.tools,
      cssLoader: { url: { filter: (url) => !url.startsWith('/') } },
    },
  }),
};

/** @type { import('@storybook/react-vite').StorybookConfig } */
export default {
  stories: ['../src/components/ui/**/*.stories.@(js|jsx)'],
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
};

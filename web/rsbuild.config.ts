import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss';

export default defineConfig({
  plugins: [pluginReact(), pluginTailwindcss()],
  source: { entry: { index: './src/main.tsx' } },
  html: { template: './index.html' },
  tools: {
    cssLoader: { url: { filter: (url) => !url.startsWith('/') } },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/v1': { target: 'http://localhost:3000', changeOrigin: true, ws: true },
    },
  },
  output: {
    assetPrefix: '/',
    distPath: {
      root: 'dist',
      js: 'assets/js',
      css: 'assets/css',
      font: 'assets/fonts',
      image: 'assets/images',
      svg: 'assets/svg',
    },
  },
});

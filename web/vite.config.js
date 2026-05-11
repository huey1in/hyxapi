import { defineConfig, transformWithEsbuild } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    {
      name: 'treat-js-files-as-jsx',
      async transform(code, id) {
        if (!/src\/.*\.js$/.test(id)) return null;
        return transformWithEsbuild(code, id, { loader: 'jsx', jsx: 'automatic' });
      },
    },
    react(),
  ],
  optimizeDeps: {
    esbuildOptions: { loader: { '.js': 'jsx', '.json': 'json' } },
  },
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/mj':  { target: 'http://localhost:3000', changeOrigin: true },
      '/pg':  { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});

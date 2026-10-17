import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/v1':  { target: 'http://localhost:3000', changeOrigin: true },
      '/pg':  { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return;
          if (id.includes('react-dom') || id.includes('react-router')) return 'react';
          if (id.includes('lucide-react')) return 'lucide';
          if (id.includes('axios') || id.includes('clsx')) return 'utils';
          if (id.includes('i18next')) return 'i18n';
          if (id.includes('prismjs')) return 'prism';
        },
      },
    },
  },
});

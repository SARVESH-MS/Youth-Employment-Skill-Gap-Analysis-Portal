import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: { '/api': 'http://localhost:5000' },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('/node_modules/')) return undefined;
          if (id.includes('/@lezer/')) return 'editor-parsers';
          if (id.includes('/@codemirror/lang-')) return 'editor-languages';
          if (id.includes('/@codemirror/') || id.includes('/@uiw/') || id.includes('/codemirror/')) return 'editor-core';
          if (id.includes('/recharts/') || id.includes('/d3-')) return 'charting';
          if (id.includes('/framer-motion/') || id.includes('/motion-dom/') || id.includes('/motion-utils/')) return 'motion';
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router') || id.includes('/scheduler/')) return 'react-vendor';
          return undefined;
        },
      },
    },
  },
});

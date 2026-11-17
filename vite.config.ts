import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: Number(process.env.STUDY_WEB_PORT ?? 43387),
    strictPort: true,
    proxy: {
      '/api': `http://127.0.0.1:${process.env.STUDY_API_PORT ?? 43388}`,
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});

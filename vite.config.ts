import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      allowedHosts: true,
      host: '0.0.0.0',
      watch: {
        ignored: [
          '**/pb_data/**',
          '**/.local/**',
          '**/.cache/**',
          '**/pb_migrations/**',
          '**/node_modules/**',
          '**/dist/**',
          '**/.replit',
          '**/replit.md',
          '**/*.md',
        ],
      },
      proxy: {
        '/pb-api': {
          target: 'http://localhost:8090',
          rewrite: (path: string) => path.replace(/^\/pb-api/, ''),
          changeOrigin: true,
          ws: true,
        },
      },
    },
    build: {
      outDir: 'dist/public',
    },
  };
});

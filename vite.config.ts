import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // Use process.env.PORT for Railway (runtime env var), fallback to 4173
  const port = parseInt(process.env.PORT || env.PORT || '4173');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    preview: {
      port: port,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    }
  };
});

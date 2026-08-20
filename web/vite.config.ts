import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const rootEnv = loadEnv(mode, path.resolve(import.meta.dirname, '..'), '');
  const webEnv = loadEnv(mode, import.meta.dirname, '');
  const convexUrl =
    process.env.VITE_CONVEX_URL ?? webEnv.VITE_CONVEX_URL ?? process.env.CONVEX_URL ?? rootEnv.CONVEX_URL ?? '';

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_CONVEX_URL': JSON.stringify(convexUrl),
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
        '@convex': path.resolve(import.meta.dirname, '../convex'),
      },
    },
  };
});

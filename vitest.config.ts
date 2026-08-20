/// <reference types="vitest/config" />

import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        resolve: {
          alias: {
            '@': path.resolve(__dirname, 'web/src'),
            '@convex': path.resolve(__dirname, 'convex'),
          },
        },
        test: {
          name: 'web',
          globals: true,
          environment: 'jsdom',
          setupFiles: ['web/src/test-setup.ts'],
          include: ['web/src/**/*.{test,spec}.{ts,tsx}'],
        },
      },
      {
        resolve: {
          alias: [
            {
              find: /.*\/_generated\/api$/,
              replacement: path.resolve(__dirname, 'convex/__mocks__/_generated/api.ts'),
            },
            {
              find: /.*\/_generated\/server$/,
              replacement: path.resolve(__dirname, 'convex/__mocks__/_generated/server.ts'),
            },
          ],
        },
        test: {
          name: 'convex',
          globals: true,
          environment: 'node',
          include: ['convex/**/*.{test,spec}.ts'],
          exclude: ['convex/_generated/**'],
        },
      },
    ],
  },
});

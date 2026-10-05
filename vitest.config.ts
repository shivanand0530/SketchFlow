import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src'), '@shared': path.resolve(__dirname, 'shared') } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['server/src/**/*.ts', 'src/auth/**/*.tsx', 'src/services/**/*.ts', 'src/store/**/*.ts'],
      exclude: ['**/index.ts', '**/types.ts'],
    },
  },
});
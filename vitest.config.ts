import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.vitest.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    globals: true,
    environment: 'node',
  },
});
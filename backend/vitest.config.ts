import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    restoreMocks: true,
    exclude: ['src/**/*.integration.test.ts', '**/node_modules/**', '**/dist/**'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});

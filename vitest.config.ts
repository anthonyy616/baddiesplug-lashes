import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    // Allow importing from src directory
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // Setup files run before tests
    setupFiles: ['./tests/setup.ts'],
    // Globals for test assertions
    environmentOptions: {
      node: {
        // Enable for database tests
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

import { defineConfig } from 'vitest/config';

// Standalone config so the adapter's tests run independently of the monorepo
// (the root config only globs packages/*/src). Used for local verification;
// the target repo runs these under its own vitest setup.
export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    environment: 'node',
  },
});

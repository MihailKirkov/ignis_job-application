import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Vitest 4 resolves tsconfig `paths` (the @/* alias) natively.
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});

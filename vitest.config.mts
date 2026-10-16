import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'e2e/**', 'src/**/*.db.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/app/api/**', 'src/types/**'],
      exclude: ['**/*.test.{ts,tsx}', 'src/test/**'],
      reporter: ['text-summary', 'json-summary'],
      // Ratsche: knapp unter dem gemessenen Stand (78/64/80/79 %), nur anheben
      thresholds: { statements: 77, branches: 62, functions: 78, lines: 78 },
    },
  },
});

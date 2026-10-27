import { defineConfig } from 'vitest/config';

// Nur die Tests der reinen Kernmodule: schnell, ohne I/O. Genutzt von `npm run mutation`, nicht von `npm test`.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    name: 'mutation-core',
    root: process.cwd(),
    environment: 'node',
    include: [
      'src/lib/knowledge/rules/rule-selector.test.ts',
      'src/lib/knowledge/eval-gate.test.ts',
      'scripts/agent/guards*.test.mjs',
    ],
  },
});

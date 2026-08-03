import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The bundled fixture projects under `fixtures/` contain their own
    // `*.test.js`/`*.spec.ts` files (using node:test/Jest, not Vitest) as
    // realistic sample content — they must never be collected as this
    // package's own test suite.
    exclude: ['**/node_modules/**', 'fixtures/**', 'dist/**'],
  },
});

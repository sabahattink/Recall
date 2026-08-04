import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The packaging test (packaging.test.ts) runs `npm pack`, which mutates
    // this package's own dist/ and package.json in place via prepack.
    // Running it concurrently with smoke.test.ts / cli.integration.test.ts —
    // which both spawn `node dist/index.js` as a subprocess — would race
    // against that mutation. Vitest parallelizes across test *files* by
    // default, so this package's small suite runs its files sequentially
    // instead.
    fileParallelism: false,
  },
});

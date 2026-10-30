import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  REFERENCE_FIXTURES,
  createTempDir,
  integrationHookTimeout,
  integrationTestTimeout,
  removeTempDir,
} from '@recall-ai/test-fixtures';
import { runInit } from '../index.js';
import { snapshotTree } from './tree-snapshot.js';

const RUNS_FOR_DETERMINISM = 10;

/**
 * End-to-end golden suite (REL-06, TPL-07, REL-02): every reference
 * fixture is initialized from scratch and its complete `.recall/` output is
 * compared, file by file, with the committed golden copy under
 * `__golden__/<fixture>/`. An intended output change is made by
 * regenerating the golden files (`vitest run -u`) and reviewing the diff;
 * an unintended one fails here.
 *
 * Git metadata is deliberately absent (fixtures are not repositories):
 * commit hashes depend on commit timestamps, so they are covered by the
 * non-golden git test in run-init.test.ts instead.
 */
describe.each(REFERENCE_FIXTURES.map((fixture) => [fixture.name, fixture] as const))(
  'reference fixture "%s"',
  (name, fixture) => {
    let dir: string;
    let output: Record<string, string>;

    beforeAll(async () => {
      dir = await createTempDir(`recall-${name}-`);
      await fixture.build(dir);
      await runInit({ path: dir, force: false, readGitMetadata: async () => null });
      output = await snapshotTree(dir);
    }, integrationHookTimeout);

    afterAll(async () => {
      await removeTempDir(dir);
    });

    it('produces .recall/ output matching the committed golden files', async () => {
      const recallFiles = Object.entries(output).filter(([path]) => path.startsWith('.recall/'));
      expect(recallFiles.map(([path]) => path)).toHaveLength(6);
      for (const [path, contents] of recallFiles) {
        await expect(contents).toMatchFileSnapshot(
          `./__golden__/${name}/${path.slice('.recall/'.length)}`,
        );
      }
    });

    it(
      `is byte-identical across ${RUNS_FOR_DETERMINISM} consecutive --force runs`,
      async () => {
        for (let run = 0; run < RUNS_FOR_DETERMINISM; run++) {
          await runInit({ path: dir, force: true, readGitMetadata: async () => null });
          expect(await snapshotTree(dir)).toEqual(output);
        }
      },
      integrationTestTimeout * 4,
    );
  },
);

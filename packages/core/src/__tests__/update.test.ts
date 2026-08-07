import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildSimpleNodeFixture,
  commitAll,
  createTempDir,
  initGitRepo,
  integrationHookTimeout,
  integrationTestTimeout,
  removeTempDir,
} from '@recall-ai/test-fixtures';
import { runInit } from '../use-cases/init.js';
import { runUpdate } from '../use-cases/update.js';
import { InvalidStateError } from '../errors.js';

// `runUpdate` throws `InvalidStateError` immediately after `readManifest`/
// `readSnapshot` come back empty — before it ever calls `runScan` — so this
// case needs only a bare, uninitialized temp dir. It intentionally lives
// outside `describe('runUpdate', ...)` below: that block's beforeEach does
// initGitRepo + commitAll + a full runInit (~11 real `git` spawns) to set up
// a fixture this test doesn't touch, which is exactly why it measured
// 4897ms on Windows CI — dangerously close to the 5000ms default for a test
// whose own assertion does zero Git/FS work. Removing the unnecessary
// dependency on that fixture (rather than just widening its timeout) is the
// actual fix.
describe('runUpdate (uninitialized target)', () => {
  it('throws InvalidStateError when Recall has not been initialized', async () => {
    const other = await createTempDir();
    try {
      await expect(runUpdate({ path: other, toolVersion: '0.1.0' })).rejects.toThrow(
        InvalidStateError,
      );
    } finally {
      await removeTempDir(other);
    }
  });
});

describe('runUpdate', () => {
  let dir: string;

  // initGitRepo + commitAll + a full runInit (~11 real `git` spawns) before
  // every test in this block — measured as part of the same call path that
  // hit 6482ms in doctor.test.ts's clean-init case, and every test below
  // adds further real git/runUpdate work on top of it.
  beforeEach(async () => {
    dir = await createTempDir();
    await buildSimpleNodeFixture(dir);
    await initGitRepo(dir);
    await commitAll(dir, 'chore: initial commit');
    await runInit({ path: dir, toolVersion: '0.1.0' });
  }, integrationHookTimeout);

  afterEach(async () => {
    await removeTempDir(dir);
  });

  it(
    'reports no changes when the repository is untouched',
    async () => {
      const result = await runUpdate({ path: dir, toolVersion: '0.1.0' });
      expect(result.changeReport.hasChanges).toBe(false);
      expect(result.staleness.stale).toBe(false);
    },
    integrationTestTimeout,
  );

  it(
    'detects new files as changes and reports staleness',
    async () => {
      await writeFile(join(dir, 'src/new-feature.js'), 'module.exports = {};\n', 'utf8');
      await commitAll(dir, 'feat: add new feature');

      const result = await runUpdate({ path: dir, toolVersion: '0.1.0', check: true });
      expect(result.changeReport.filesAdded).toContain('src/new-feature.js');
      expect(result.staleness.stale).toBe(true);
      expect(result.applied).toBe(false);
    },
    integrationTestTimeout,
  );

  // Calls `runUpdate` twice — roughly double the git-spawn cost of the test
  // above.
  it(
    'applies updates and persists the new snapshot when not in check/dry-run mode',
    async () => {
      await writeFile(join(dir, 'src/new-feature.js'), 'module.exports = {};\n', 'utf8');
      await commitAll(dir, 'feat: add new feature');

      const result = await runUpdate({ path: dir, toolVersion: '0.1.0' });
      expect(result.applied).toBe(true);

      const followUp = await runUpdate({ path: dir, toolVersion: '0.1.0' });
      expect(followUp.changeReport.hasChanges).toBe(false);
    },
    integrationTestTimeout,
  );

  it(
    'does not write anything in dry-run mode',
    async () => {
      await writeFile(join(dir, 'src/new-feature.js'), 'module.exports = {};\n', 'utf8');
      await commitAll(dir, 'feat: add new feature');

      const result = await runUpdate({ path: dir, toolVersion: '0.1.0', dryRun: true });
      expect(result.applied).toBe(false);

      const followUp = await runUpdate({ path: dir, toolVersion: '0.1.0', check: true });
      expect(followUp.staleness.stale).toBe(true);
    },
    integrationTestTimeout,
  );
});

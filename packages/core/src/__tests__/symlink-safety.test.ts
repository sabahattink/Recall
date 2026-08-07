import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildSimpleNodeFixture,
  commitAll,
  createDirLink,
  createTempDir,
  initGitRepo,
  integrationTestTimeout,
  removeTempDir,
} from '@recall-ai/test-fixtures';
import { runInit } from '../use-cases/init.js';
import { runUpdate } from '../use-cases/update.js';
import { InvalidStateError } from '../errors.js';

/**
 * End-to-end proof that a repository attempting to redirect Recall's
 * writes via a symlinked `.recall` (or a symlink planted deeper inside an
 * already-initialized `.recall`) is rejected before anything is written
 * through it — exercised through the real `runInit`/`runUpdate` use cases,
 * not just the low-level `atomicWriteFile` primitive.
 */
describe('symlink attack resistance (integration)', () => {
  let repoDir: string;
  let outsideDir: string;

  beforeEach(async () => {
    repoDir = await createTempDir('recall-repo-');
    outsideDir = await createTempDir('recall-outside-');
    await buildSimpleNodeFixture(repoDir);
    await initGitRepo(repoDir);
    await commitAll(repoDir, 'chore: initial commit');
  });

  afterEach(async () => {
    await removeTempDir(repoDir);
    await removeTempDir(outsideDir);
  });

  // Every test in this block shares the beforeEach's real Git init + commit
  // and then drives at least one full `runInit`/`runUpdate` call (init/update
  // → scan → GitAdapter.collectMetadata + listTrackedFiles) — a chain of real
  // `git` subprocess spawns that has measured over Vitest's default 5000ms
  // testTimeout on Windows CI, where each spawn carries process-creation/
  // AV-scan overhead far higher than on Linux/macOS or a local dev machine.
  it(
    'refuses to init through a pre-planted symlinked .recall directory',
    async () => {
      await createDirLink(outsideDir, join(repoDir, '.recall'));

      await expect(runInit({ path: repoDir, toolVersion: '0.1.0' })).rejects.toThrow(
        InvalidStateError,
      );

      const outsideEntries = await readdir(outsideDir);
      expect(outsideEntries).toEqual([]);
    },
    integrationTestTimeout,
  );

  it(
    'refuses to update through a .recall directory replaced by a symlink after init',
    async () => {
      await runInit({ path: repoDir, toolVersion: '0.1.0' });

      // Simulate an attacker (or a broken tool) swapping the real .recall
      // directory for a symlink between commands.
      const { rm } = await import('node:fs/promises');
      await rm(join(repoDir, '.recall'), { recursive: true, force: true });
      await createDirLink(outsideDir, join(repoDir, '.recall'));

      await expect(runUpdate({ path: repoDir, toolVersion: '0.1.0' })).rejects.toThrow(
        InvalidStateError,
      );

      const outsideEntries = await readdir(outsideDir);
      expect(outsideEntries).toEqual([]);
    },
    integrationTestTimeout,
  );

  it(
    'refuses to init through a symlink planted one level below an existing .recall',
    async () => {
      await mkdir(join(repoDir, '.recall'), { recursive: true });
      await createDirLink(outsideDir, join(repoDir, '.recall', 'snapshots'));

      await expect(runInit({ path: repoDir, toolVersion: '0.1.0' })).rejects.toThrow();

      const outsideEntries = await readdir(outsideDir);
      expect(outsideEntries).toEqual([]);
    },
    integrationTestTimeout,
  );

  it(
    'succeeds normally once the symlink is removed (control case)',
    async () => {
      const result = await runInit({ path: repoDir, toolVersion: '0.1.0' });
      expect(result.wasAlreadyInitialized).toBe(false);
      expect(result.memoryFileUpdates.every((u) => u.changed)).toBe(true);
    },
    integrationTestTimeout,
  );
});

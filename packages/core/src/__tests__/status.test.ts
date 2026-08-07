import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildSimpleNodeFixture,
  commitAll,
  createTempDir,
  initGitRepo,
  integrationTestTimeout,
  removeTempDir,
} from '@recall-ai/test-fixtures';
import { runInit } from '../use-cases/init.js';
import { runStatus } from '../use-cases/status.js';

describe('runStatus', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempDir();
    await buildSimpleNodeFixture(dir);
    await initGitRepo(dir);
    await commitAll(dir, 'chore: initial commit');
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  it('reports not-initialized before recall init has run', async () => {
    const status = await runStatus(dir);
    expect(status.initialized).toBe(false);
    expect(status.overallStatus).toBe('not-initialized');
    expect(status.missingMemoryFiles.length).toBeGreaterThan(0);
  });

  // Both tests below run `runInit` (init → scan → GitAdapter.collectMetadata
  // + listTrackedFiles) followed by `runStatus` (currentCommit/currentBranch
  // /changedFiles), on top of this describe block's beforeEach
  // (initGitRepo + commitAll) — a chain of real `git` subprocess spawns that
  // has measured over Vitest's default 5000ms testTimeout on Windows CI,
  // where each spawn carries process-creation/AV-scan overhead far higher
  // than on Linux/macOS or a local dev machine. The "stale" variant below
  // does strictly more of the same work (one extra commitAll), so it shares
  // the same risk even though it wasn't the one CI happened to flag.
  it(
    'reports ok immediately after a clean init',
    async () => {
      await runInit({ path: dir, toolVersion: '0.1.0' });
      const status = await runStatus(dir);
      expect(status.initialized).toBe(true);
      expect(status.overallStatus).toBe('ok');
      expect(status.missingMemoryFiles).toEqual([]);
      expect(status.malformedFiles).toEqual([]);
      expect(status.detectedProjectType).not.toBeNull();
    },
    integrationTestTimeout,
  );

  it(
    'reports stale after new commits change the repository',
    async () => {
      await runInit({ path: dir, toolVersion: '0.1.0' });
      await writeFile(join(dir, 'src/extra.js'), 'module.exports = {};\n', 'utf8');
      await commitAll(dir, 'feat: extra file');

      const status = await runStatus(dir);
      expect(status.overallStatus).toBe('stale');
      expect(status.stale).toBe(true);
    },
    integrationTestTimeout,
  );
});

describe('runStatus (non-Git repository)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempDir();
    await buildSimpleNodeFixture(dir);
    // Deliberately no initGitRepo/commitAll: a non-Git repository has no
    // commit to key freshness off of, which is exactly the case that must
    // not be conflated with "no snapshot was ever recorded".
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  it('reports ok immediately after a clean init, with no commit available', async () => {
    await runInit({ path: dir, toolVersion: '0.1.0' });
    const status = await runStatus(dir);
    expect(status.currentCommit).toBeNull();
    expect(status.lastSnapshotCommit).toBeNull();
    expect(status.initialized).toBe(true);
    expect(status.overallStatus).toBe('ok');
    expect(status.stale).toBe(false);
  });

  it('reports stale after a source file changes', async () => {
    await runInit({ path: dir, toolVersion: '0.1.0' });
    await writeFile(join(dir, 'src/index.js'), 'module.exports = { changed: true };\n', 'utf8');

    const status = await runStatus(dir);
    expect(status.overallStatus).toBe('stale');
    expect(status.stale).toBe(true);
    expect(status.staleReasons.join(' ')).toMatch(/differ from the last snapshot/);
  });
});

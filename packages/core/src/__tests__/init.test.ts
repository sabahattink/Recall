import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { access, readFile, writeFile } from 'node:fs/promises';
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

describe('runInit', () => {
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

  // Every test in this file calls `runInit` at least once — each call is
  // init → scan → GitAdapter.collectMetadata + listTrackedFiles, ~8 real
  // `git` spawns — on top of this describe block's beforeEach (initGitRepo +
  // commitAll). The two tests that call `runInit` twice pay that cost twice.
  it(
    'creates the full .recall directory structure',
    async () => {
      const result = await runInit({ path: dir, toolVersion: '0.1.0' });
      expect(result.wasAlreadyInitialized).toBe(false);

      await expect(access(join(dir, '.recall', 'manifest.json'))).resolves.toBeUndefined();
      await expect(
        access(join(dir, '.recall', 'snapshots', 'latest.json')),
      ).resolves.toBeUndefined();
      for (const file of [
        'architecture.md',
        'conventions.md',
        'decisions.md',
        'features.md',
        'glossary.md',
        'risks.md',
        'technical-debt.md',
      ]) {
        await expect(access(join(dir, '.recall', file))).resolves.toBeUndefined();
      }
    },
    integrationTestTimeout,
  );

  it(
    'adds .recall/cache/ to .gitignore',
    async () => {
      await runInit({ path: dir, toolVersion: '0.1.0' });
      const gitignore = await readFile(join(dir, '.gitignore'), 'utf8');
      expect(gitignore).toContain('.recall/cache/');
    },
    integrationTestTimeout,
  );

  it(
    'does not modify source files',
    async () => {
      const before = await readFile(join(dir, 'src/index.js'), 'utf8');
      await runInit({ path: dir, toolVersion: '0.1.0' });
      const after = await readFile(join(dir, 'src/index.js'), 'utf8');
      expect(after).toBe(before);
    },
    integrationTestTimeout,
  );

  it(
    'does not write anything in dry-run mode',
    async () => {
      await runInit({ path: dir, toolVersion: '0.1.0', dryRun: true });
      await expect(access(join(dir, '.recall'))).rejects.toThrow();
    },
    integrationTestTimeout,
  );

  // Calls `runInit` twice — roughly double the git-spawn cost of the tests
  // above.
  it(
    'is idempotent when run twice in a row',
    async () => {
      const first = await runInit({ path: dir, toolVersion: '0.1.0' });
      const second = await runInit({ path: dir, toolVersion: '0.1.0' });

      expect(first.wasAlreadyInitialized).toBe(false);
      expect(second.wasAlreadyInitialized).toBe(true);
      expect(second.memoryFileUpdates.every((u) => !u.changed)).toBe(true);
    },
    integrationTestTimeout,
  );

  it(
    'preserves manually edited memory file content across a second init',
    async () => {
      await runInit({ path: dir, toolVersion: '0.1.0' });
      const architecturePath = join(dir, '.recall', 'architecture.md');
      const original = await readFile(architecturePath, 'utf8');
      await writeFile(
        architecturePath,
        original.replace('## Notes', '## Notes\n\nHand-written context.'),
        'utf8',
      );

      await runInit({ path: dir, toolVersion: '0.1.0' });
      const finalContent = await readFile(architecturePath, 'utf8');
      expect(finalContent).toContain('Hand-written context.');
    },
    integrationTestTimeout,
  );
});

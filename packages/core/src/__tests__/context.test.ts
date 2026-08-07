import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { access } from 'node:fs/promises';
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
import { runContext } from '../use-cases/context.js';
import { InvalidStateError } from '../errors.js';

describe('runContext', () => {
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

  it('throws InvalidStateError when no snapshot exists yet', async () => {
    await expect(runContext({ path: dir })).rejects.toThrow(InvalidStateError);
  });

  // All three tests below call `runInit` (~8 real `git` spawns via
  // scan-runner's GitAdapter.collectMetadata + listTrackedFiles), on top of
  // this describe block's beforeEach (initGitRepo + commitAll).
  // `runContext` itself does no further Git work — it only reads the
  // snapshot `runInit` just wrote.
  it(
    'writes context.md by default',
    async () => {
      await runInit({ path: dir, toolVersion: '0.1.0' });
      const result = await runContext({ path: dir });
      expect(result.outputPath).toBe(join(dir, '.recall', 'context.md'));
      await expect(access(result.outputPath as string)).resolves.toBeUndefined();
    },
    integrationTestTimeout,
  );

  it(
    'does not write a file when stdout mode is requested',
    async () => {
      await runInit({ path: dir, toolVersion: '0.1.0' });
      const result = await runContext({ path: dir, stdout: true });
      expect(result.outputPath).toBeNull();
      expect(result.content.length).toBeGreaterThan(0);
    },
    integrationTestTimeout,
  );

  it(
    'produces task-focused output that differs from the default',
    async () => {
      await runInit({ path: dir, toolVersion: '0.1.0' });
      const withoutTask = await runContext({ path: dir, stdout: true });
      const withTask = await runContext({
        path: dir,
        stdout: true,
        task: 'Implement password reset',
      });
      expect(withTask.content).toContain('password reset');
      expect(withTask.content).not.toBe(withoutTask.content);
    },
    integrationTestTimeout,
  );
});

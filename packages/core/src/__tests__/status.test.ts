import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildSimpleNodeFixture,
  commitAll,
  createTempDir,
  initGitRepo,
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

  it('reports ok immediately after a clean init', async () => {
    await runInit({ path: dir, toolVersion: '0.1.0' });
    const status = await runStatus(dir);
    expect(status.initialized).toBe(true);
    expect(status.overallStatus).toBe('ok');
    expect(status.missingMemoryFiles).toEqual([]);
    expect(status.malformedFiles).toEqual([]);
    expect(status.detectedProjectType).not.toBeNull();
  });

  it('reports stale after new commits change the repository', async () => {
    await runInit({ path: dir, toolVersion: '0.1.0' });
    await writeFile(join(dir, 'src/extra.js'), 'module.exports = {};\n', 'utf8');
    await commitAll(dir, 'feat: extra file');

    const status = await runStatus(dir);
    expect(status.overallStatus).toBe('stale');
    expect(status.stale).toBe(true);
  });
});

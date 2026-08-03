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
import { runUpdate } from '../use-cases/update.js';
import { InvalidStateError } from '../errors.js';

describe('runUpdate', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempDir();
    await buildSimpleNodeFixture(dir);
    await initGitRepo(dir);
    await commitAll(dir, 'chore: initial commit');
    await runInit({ path: dir, toolVersion: '0.1.0' });
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

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

  it('reports no changes when the repository is untouched', async () => {
    const result = await runUpdate({ path: dir, toolVersion: '0.1.0' });
    expect(result.changeReport.hasChanges).toBe(false);
    expect(result.staleness.stale).toBe(false);
  });

  it('detects new files as changes and reports staleness', async () => {
    await writeFile(join(dir, 'src/new-feature.js'), 'module.exports = {};\n', 'utf8');
    await commitAll(dir, 'feat: add new feature');

    const result = await runUpdate({ path: dir, toolVersion: '0.1.0', check: true });
    expect(result.changeReport.filesAdded).toContain('src/new-feature.js');
    expect(result.staleness.stale).toBe(true);
    expect(result.applied).toBe(false);
  });

  it('applies updates and persists the new snapshot when not in check/dry-run mode', async () => {
    await writeFile(join(dir, 'src/new-feature.js'), 'module.exports = {};\n', 'utf8');
    await commitAll(dir, 'feat: add new feature');

    const result = await runUpdate({ path: dir, toolVersion: '0.1.0' });
    expect(result.applied).toBe(true);

    const followUp = await runUpdate({ path: dir, toolVersion: '0.1.0' });
    expect(followUp.changeReport.hasChanges).toBe(false);
  });

  it('does not write anything in dry-run mode', async () => {
    await writeFile(join(dir, 'src/new-feature.js'), 'module.exports = {};\n', 'utf8');
    await commitAll(dir, 'feat: add new feature');

    const result = await runUpdate({ path: dir, toolVersion: '0.1.0', dryRun: true });
    expect(result.applied).toBe(false);

    const followUp = await runUpdate({ path: dir, toolVersion: '0.1.0', check: true });
    expect(followUp.staleness.stale).toBe(true);
  });
});

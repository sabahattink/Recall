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
import { runDoctor } from '../use-cases/doctor.js';

describe('runDoctor', () => {
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

  it('fails cleanly when Recall has not been initialized', async () => {
    const result = await runDoctor(dir);
    expect(result.overallStatus).toBe('fail');
    expect(result.checks.some((c) => c.id === 'recall-initialized' && c.status === 'fail')).toBe(
      true,
    );
  });

  it('passes all checks immediately after a clean init', async () => {
    await runInit({ path: dir, toolVersion: '0.1.0' });
    const result = await runDoctor(dir);
    expect(result.overallStatus).not.toBe('fail');
    expect(result.checks.some((c) => c.id === 'manifest-valid' && c.status === 'pass')).toBe(true);
    expect(result.checks.some((c) => c.id === 'snapshot-valid' && c.status === 'pass')).toBe(true);
  });

  it('detects a corrupted manifest as a parse failure', async () => {
    await runInit({ path: dir, toolVersion: '0.1.0' });
    await writeFile(join(dir, '.recall', 'manifest.json'), '{ not valid json', 'utf8');

    const result = await runDoctor(dir);
    expect(result.overallStatus).toBe('fail');
    expect(result.checks.some((c) => c.id === 'manifest-valid' && c.status === 'fail')).toBe(true);
  });

  it('detects malformed markers in a memory file', async () => {
    await runInit({ path: dir, toolVersion: '0.1.0' });
    await writeFile(
      join(dir, '.recall', 'risks.md'),
      '<!-- recall:generated:start -->\nno end marker',
      'utf8',
    );

    const result = await runDoctor(dir);
    expect(result.checks.some((c) => c.id === 'markers-risks.md' && c.status === 'fail')).toBe(
      true,
    );
  });
});

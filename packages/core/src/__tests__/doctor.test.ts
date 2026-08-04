import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildSimpleNodeFixture,
  commitAll,
  createDirLink,
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

  it('reports memory freshness as PASS (not WARN) immediately after a clean init', async () => {
    await runInit({ path: dir, toolVersion: '0.1.0' });
    const result = await runDoctor(dir);
    const freshness = result.checks.find((c) => c.id === 'memory-freshness');
    expect(freshness?.status).toBe('pass');
  });

  it('reports the runtime-version check as PASS on Node 22+ and states the Node 22+ requirement', async () => {
    const result = await runDoctor(dir);
    const runtimeCheck = result.checks.find((c) => c.id === 'runtime-version');
    expect(runtimeCheck?.status).toBe('pass');
    expect(runtimeCheck?.detail).toContain('Node.js 22+');
    expect(runtimeCheck?.detail).not.toContain('18+');
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

  it('fails cleanly and stops early when .recall is a symlink', async () => {
    const outsideDir = await createTempDir('recall-outside-');
    try {
      await mkdir(outsideDir, { recursive: true });
      await createDirLink(outsideDir, join(dir, '.recall'));

      const result = await runDoctor(dir);
      expect(result.overallStatus).toBe('fail');
      expect(
        result.checks.some((c) => c.id === 'recall-dir-not-symlink' && c.status === 'fail'),
      ).toBe(true);
      // Should stop before attempting any read/write through the symlink.
      expect(result.checks.some((c) => c.id === 'manifest-valid')).toBe(false);
      expect(result.checks.some((c) => c.id === 'write-permission')).toBe(false);
    } finally {
      await removeTempDir(outsideDir);
    }
  });
});

describe('runDoctor (non-Git repository)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempDir();
    await buildSimpleNodeFixture(dir);
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  it('reports memory freshness as PASS immediately after a clean init with no commit available', async () => {
    await runInit({ path: dir, toolVersion: '0.1.0' });
    const result = await runDoctor(dir);
    const freshness = result.checks.find((c) => c.id === 'memory-freshness');
    expect(freshness?.status).toBe('pass');
  });
});

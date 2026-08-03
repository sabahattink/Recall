import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import {
  buildSimpleNodeFixture,
  commitAll,
  createTempDir,
  initGitRepo,
  removeTempDir,
} from '@recall-ai/test-fixtures';

const here = dirname(fileURLToPath(import.meta.url));
const cliEntry = join(here, '..', '..', 'dist', 'index.js');

async function runCliSubprocess(args: string[]) {
  return execa('node', [cliEntry, ...args], { reject: false });
}

describe('recall CLI smoke tests (compiled subprocess)', () => {
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

  it('prints a version string', async () => {
    const result = await runCliSubprocess(['--version']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim().length).toBeGreaterThan(0);
  });

  it('runs init, status, and context end-to-end against a fixture', async () => {
    const init = await runCliSubprocess(['init', '--path', dir]);
    expect(init.exitCode).toBe(0);
    await expect(access(join(dir, '.recall', 'manifest.json'))).resolves.toBeUndefined();

    const status = await runCliSubprocess(['status', '--path', dir]);
    expect(status.exitCode).toBe(0);

    const context = await runCliSubprocess(['context', '--path', dir, '--stdout']);
    expect(context.exitCode).toBe(0);
    expect(context.stdout).toContain('# Recall Context');
  });

  it('exits with invalid-usage code for a missing path', async () => {
    const result = await runCliSubprocess(['status', '--path', '/definitely/not/a/real/path']);
    expect(result.exitCode).toBe(2);
  });

  it('never requires network access to complete init', async () => {
    const result = await runCliSubprocess(['init', '--path', dir]);
    expect(result.exitCode).toBe(0);
  });
});

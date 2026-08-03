import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execa } from 'execa';
import { GitAdapter } from '../adapter.js';

async function initRepo(dir: string): Promise<void> {
  await execa('git', ['init', '-q', '-b', 'main', dir]);
  await execa('git', ['-C', dir, 'config', 'user.email', 'test@example.com']);
  await execa('git', ['-C', dir, 'config', 'user.name', 'Recall Test']);
}

async function commitAll(dir: string, message: string): Promise<void> {
  await execa('git', ['-C', dir, 'add', '-A']);
  await execa('git', ['-C', dir, 'commit', '-q', '-m', message]);
}

describe('GitAdapter', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'recall-git-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reports isRepository as false for a plain directory', async () => {
    const adapter = new GitAdapter(dir);
    expect(await adapter.isRepository()).toBe(false);
  });

  it('reports isRepository as true and returns branch/commit info after init', async () => {
    await initRepo(dir);
    await writeFile(join(dir, 'README.md'), '# hello\n');
    await commitAll(dir, 'chore: initial commit');

    const adapter = new GitAdapter(dir);
    expect(await adapter.isRepository()).toBe(true);
    expect(await adapter.currentBranch()).toBe('main');
    const commit = await adapter.currentCommit();
    expect(commit).toMatch(/^[0-9a-f]{40}$/);
    expect(await adapter.isDirty()).toBe(false);
  });

  it('detects a dirty working tree', async () => {
    await initRepo(dir);
    await writeFile(join(dir, 'README.md'), '# hello\n');
    await commitAll(dir, 'chore: initial commit');
    await writeFile(join(dir, 'README.md'), '# changed\n');

    const adapter = new GitAdapter(dir);
    expect(await adapter.isDirty()).toBe(true);
    const changed = await adapter.changedFiles();
    expect(changed).toContain('README.md');
  });

  it('computes diff name-status between two refs', async () => {
    await initRepo(dir);
    await writeFile(join(dir, 'a.txt'), 'a\n');
    await commitAll(dir, 'chore: add a');
    const first = await new GitAdapter(dir).currentCommit();

    await mkdir(join(dir, 'sub'), { recursive: true });
    await writeFile(join(dir, 'b.txt'), 'b\n');
    await execa('git', ['-C', dir, 'rm', '-q', 'a.txt']);
    await commitAll(dir, 'chore: swap a for b');

    const adapter = new GitAdapter(dir);
    const diff = await adapter.diffNameStatus(first as string, 'HEAD');
    const paths = diff.map((entry) => entry.path).sort();
    expect(paths).toEqual(['a.txt', 'b.txt']);
  });

  it('collectMetadata returns null outside a repository', async () => {
    const adapter = new GitAdapter(dir);
    expect(await adapter.collectMetadata()).toBeNull();
  });

  it('lists tracked files', async () => {
    await initRepo(dir);
    await writeFile(join(dir, 'a.txt'), 'a\n');
    await mkdir(join(dir, 'sub'), { recursive: true });
    await writeFile(join(dir, 'sub', 'b.txt'), 'b\n');
    await commitAll(dir, 'chore: add files');

    const adapter = new GitAdapter(dir);
    const tracked = await adapter.listTrackedFiles();
    expect(tracked.sort()).toEqual(['a.txt', 'sub/b.txt']);
  });

  it('collectMetadata returns full metadata inside a repository', async () => {
    await initRepo(dir);
    await writeFile(join(dir, 'a.txt'), 'a\n');
    await commitAll(dir, 'chore: add a');

    const adapter = new GitAdapter(dir);
    const metadata = await adapter.collectMetadata();
    expect(metadata).not.toBeNull();
    expect(metadata?.branch).toBe('main');
    expect(metadata?.isDirty).toBe(false);
  });
});

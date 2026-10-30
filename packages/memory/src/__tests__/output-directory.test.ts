import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type * as FsPromises from 'node:fs/promises';
import { createDirLink, createTempDir, removeTempDir } from '@recall-ai/test-fixtures';

/**
 * `rename` is wrapped so individual tests can make it fail on demand,
 * simulating a crash or a locked directory partway through the swap.
 */
const renameFailures = vi.hoisted(() => ({ calls: 0, failOn: new Set<number>(), code: 'EIO' }));
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof FsPromises>();
  return {
    ...actual,
    rename: async (from: string, to: string) => {
      renameFailures.calls++;
      if (renameFailures.failOn.has(renameFailures.calls)) {
        throw Object.assign(new Error(`simulated ${renameFailures.code}`), {
          code: renameFailures.code,
        });
      }
      return actual.rename(from, to);
    },
  };
});

const {
  RecallDirectoryExistsError,
  UnsafeOutputLocationError,
  inspectRecallDirectory,
  writeRecallDirectory,
} = await import('../output-directory.js');

const FILES = [
  { path: 'memory.json', contents: '{}\n' },
  { path: 'agents/claude.md', contents: '# Claude\n' },
];

async function listTree(dir: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const paths = await Promise.all(
    entries.map(async (entry) =>
      entry.isDirectory()
        ? listTree(join(dir, entry.name), `${prefix}${entry.name}/`)
        : [`${prefix}${entry.name}`],
    ),
  );
  return paths.flat().sort();
}

describe('writeRecallDirectory', () => {
  let root: string;

  beforeEach(async () => {
    root = await createTempDir();
    renameFailures.calls = 0;
    renameFailures.failOn = new Set();
    renameFailures.code = 'EIO';
  });

  afterEach(async () => {
    await removeTempDir(root);
  });

  it('writes exactly the given files into .recall/ and nothing else in the repository', async () => {
    await writeFile(join(root, 'package.json'), '{}');
    await writeRecallDirectory(root, FILES, { force: false });

    expect(await listTree(root)).toEqual([
      '.recall/agents/claude.md',
      '.recall/memory.json',
      'package.json',
    ]);
    expect(await readFile(join(root, '.recall', 'agents', 'claude.md'), 'utf8')).toBe('# Claude\n');
  });

  it('refuses to touch an existing .recall/ without force', async () => {
    await mkdir(join(root, '.recall'));
    await writeFile(join(root, '.recall', 'mine.md'), 'keep me');

    await expect(writeRecallDirectory(root, FILES, { force: false })).rejects.toBeInstanceOf(
      RecallDirectoryExistsError,
    );
    expect(await listTree(root)).toEqual(['.recall/mine.md']);
  });

  it('replaces an existing .recall/ wholesale with force', async () => {
    await mkdir(join(root, '.recall'));
    await writeFile(join(root, '.recall', 'stale.md'), 'old');

    await writeRecallDirectory(root, FILES, { force: true });

    expect(await listTree(root)).toEqual(['.recall/agents/claude.md', '.recall/memory.json']);
  });

  it('leaves no .recall/ and no staging directory when the final rename fails', async () => {
    renameFailures.failOn = new Set([1]);

    await expect(writeRecallDirectory(root, FILES, { force: false })).rejects.toThrow('simulated');
    expect(await listTree(root)).toEqual([]);
  });

  it('restores the original .recall/ when a forced swap fails halfway', async () => {
    await mkdir(join(root, '.recall'));
    await writeFile(join(root, '.recall', 'original.md'), 'original');
    // Rename 1 (.recall → previous) succeeds; rename 2 (staging → .recall) fails.
    renameFailures.failOn = new Set([2]);

    await expect(writeRecallDirectory(root, FILES, { force: true })).rejects.toThrow('simulated');
    expect(await listTree(root)).toEqual(['.recall/original.md']);
  });

  it('reports both failures, and where the original is, when the restore also fails', async () => {
    await mkdir(join(root, '.recall'));
    // Rename 2 (staging → .recall) and rename 3 (previous → .recall) both fail.
    renameFailures.failOn = new Set([2, 3]);

    await expect(writeRecallDirectory(root, FILES, { force: true })).rejects.toThrow(
      /restoring the previous copy from .*\.recall\.previous-[0-9a-f]+ also failed/,
    );
  });

  it('gives .recall/ the same default permissions as the directories inside it', async () => {
    await writeRecallDirectory(root, FILES, { force: false });
    const modeOf = async (path: string) => (await stat(path)).mode & 0o777;
    expect(await modeOf(join(root, '.recall'))).toBe(await modeOf(join(root, '.recall', 'agents')));
  });

  it('retries a transiently locked rename (Windows EPERM) instead of failing', async () => {
    renameFailures.failOn = new Set([1, 2]);
    renameFailures.code = 'EPERM';

    await writeRecallDirectory(root, FILES, { force: false });

    expect(await listTree(root)).toEqual(['.recall/agents/claude.md', '.recall/memory.json']);
  });

  it('refuses a symlinked .recall even with force, writing nothing through it', async () => {
    const outside = await createTempDir('recall-outside-');
    try {
      await createDirLink(outside, join(root, '.recall'));
      expect(await inspectRecallDirectory(root)).toBe('symlink');

      await expect(writeRecallDirectory(root, FILES, { force: true })).rejects.toBeInstanceOf(
        UnsafeOutputLocationError,
      );
      expect(await readdir(outside)).toEqual([]);
    } finally {
      await removeTempDir(outside);
    }
  });

  it('refuses a .recall that is a regular file', async () => {
    await writeFile(join(root, '.recall'), 'not a directory');
    await expect(writeRecallDirectory(root, FILES, { force: true })).rejects.toBeInstanceOf(
      UnsafeOutputLocationError,
    );
  });

  it.each(['../escape.md', '/abs.md', 'agents/../../x.md', 'C:/x.md', 'agents\\x.md', ''])(
    'rejects the unsafe output path %j before writing anything',
    async (path) => {
      await expect(
        writeRecallDirectory(root, [{ path, contents: 'x' }], { force: false }),
      ).rejects.toBeInstanceOf(UnsafeOutputLocationError);
      expect(await listTree(root)).toEqual([]);
    },
  );
});

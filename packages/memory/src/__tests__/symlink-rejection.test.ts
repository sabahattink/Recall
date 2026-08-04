import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import { createTempDir, removeTempDir } from '@recall-ai/test-fixtures';
import type * as FsPromises from 'node:fs/promises';

const { lstatMock, realLstat } = vi.hoisted(() => {
  return {
    lstatMock: vi.fn(),
    realLstat: { fn: null as ((...args: unknown[]) => unknown) | null },
  };
});

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof FsPromises>();
  realLstat.fn = actual.lstat as unknown as (...args: unknown[]) => unknown;
  return { ...actual, lstat: lstatMock };
});

// Imported after the mock so `atomicWriteFile` picks up the mocked `lstat`.
const { atomicWriteFile, SymlinkWriteError } = await import('../safe-fs.js');

/**
 * `atomicWriteFile`'s symlink-target rejection normally gets exercised by
 * creating a real symlink and writing through it. On a non-elevated,
 * non-Developer-Mode Windows account, creating a real *file* symlink fails
 * with EPERM, so that integration path can't always run there. Mocking
 * `lstat` to report the target as a symbolic link keeps the guarantee
 * deterministically tested on every OS regardless of local symlink
 * privileges.
 */
describe('atomicWriteFile symlink-target rejection (mocked lstat, OS-independent)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempDir();
    lstatMock.mockReset();
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  it('rejects a write when the target path reports as a symbolic link', async () => {
    const target = join(dir, 'link.md');
    lstatMock.mockImplementation(async (...args: unknown[]) => {
      if (String(args[0]) === target) {
        return { isSymbolicLink: () => true, isDirectory: () => false };
      }
      return realLstat.fn?.(...args);
    });

    await expect(atomicWriteFile(target, 'malicious')).rejects.toThrow(SymlinkWriteError);
  });

  it('writes normally when the target path is not a symbolic link', async () => {
    lstatMock.mockImplementation(async (...args: unknown[]) => realLstat.fn?.(...args));

    const target = join(dir, 'plain.md');
    await expect(atomicWriteFile(target, 'hello')).resolves.toBeUndefined();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import type * as FsPromises from 'node:fs/promises';
import { createTempDir, removeTempDir } from '@recall-ai/test-fixtures';

const { renameMock, realRename } = vi.hoisted(() => {
  return {
    renameMock: vi.fn(),
    realRename: { fn: null as ((...args: unknown[]) => unknown) | null },
  };
});

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof FsPromises>();
  realRename.fn = actual.rename as unknown as (...args: unknown[]) => unknown;
  return { ...actual, rename: renameMock };
});

// Imported after the mock so `atomicWriteFile` picks up the mocked `rename`.
const { atomicWriteFile } = await import('../safe-fs.js');

/**
 * Simulates the well-known Windows failure mode where `fs.rename` over an
 * existing destination transiently fails (antivirus scan, search indexer,
 * or another process briefly holding the file open) before succeeding.
 * `atomicWriteFile` should retry a bounded number of times and still
 * complete the write, rather than surfacing the transient error.
 */
describe('atomicWriteFile rename retry (simulated Windows-style transient failures)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempDir();
    renameMock.mockReset();
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  it('retries past transient EBUSY/EPERM rename failures and completes the write', async () => {
    let attempts = 0;
    renameMock.mockImplementation(async (...args: unknown[]) => {
      attempts++;
      if (attempts < 3) {
        const err = new Error('resource busy or locked') as NodeJS.ErrnoException;
        err.code = attempts === 1 ? 'EBUSY' : 'EPERM';
        throw err;
      }
      return realRename.fn?.(...args);
    });

    const target = join(dir, 'file.md');
    await atomicWriteFile(target, 'hello world', { allowedRoot: dir });

    expect(attempts).toBe(3);
    expect(await readFile(target, 'utf8')).toBe('hello world');
  });

  it('gives up and surfaces the error after exhausting retries', async () => {
    renameMock.mockImplementation(async () => {
      const err = new Error('resource busy or locked') as NodeJS.ErrnoException;
      err.code = 'EBUSY';
      throw err;
    });

    const target = join(dir, 'file.md');
    await expect(atomicWriteFile(target, 'hello world', { allowedRoot: dir })).rejects.toThrow(
      /busy/,
    );
  });

  it('does not retry non-transient errors', async () => {
    renameMock.mockImplementation(async () => {
      const err = new Error('no such file or directory') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      throw err;
    });

    const target = join(dir, 'file.md');
    await expect(atomicWriteFile(target, 'hello world', { allowedRoot: dir })).rejects.toThrow(
      /no such file/,
    );
    expect(renameMock).toHaveBeenCalledTimes(1);
  });
});

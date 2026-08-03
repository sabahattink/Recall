import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { symlink, readFile } from 'node:fs/promises';
import { createTempDir, removeTempDir } from '@recall-ai/test-fixtures';
import {
  assertWithinRoot,
  atomicWriteFile,
  backupIfExists,
  PathTraversalError,
} from '../safe-fs.js';

describe('assertWithinRoot', () => {
  it('allows a path inside the root', () => {
    expect(() => assertWithinRoot('/repo', '.recall/manifest.json')).not.toThrow();
  });

  it('rejects a relative path that escapes the root', () => {
    expect(() => assertWithinRoot('/repo/.recall', '../../etc/passwd')).toThrow(PathTraversalError);
  });

  it('rejects an absolute path outside the root', () => {
    expect(() => assertWithinRoot('/repo/.recall', '/etc/passwd')).toThrow(PathTraversalError);
  });
});

describe('atomicWriteFile', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  it('writes file contents and leaves no temp file behind', async () => {
    const target = join(dir, 'nested', 'file.md');
    await atomicWriteFile(target, 'hello world');
    const contents = await readFile(target, 'utf8');
    expect(contents).toBe('hello world');
  });

  it('refuses to write through an existing symlink', async () => {
    const realFile = join(dir, 'real.md');
    await atomicWriteFile(realFile, 'real');
    const linkPath = join(dir, 'link.md');
    await symlink(realFile, linkPath);

    await expect(atomicWriteFile(linkPath, 'malicious')).rejects.toThrow(/symlink/);
  });
});

describe('backupIfExists', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  it('returns null when the target file does not yet exist', async () => {
    const result = await backupIfExists(dir, join(dir, 'missing.md'));
    expect(result).toBeNull();
  });

  it('copies existing content into a backup file before overwrite', async () => {
    const target = join(dir, 'architecture.md');
    await atomicWriteFile(target, 'original content');
    const backupPath = await backupIfExists(dir, target);
    expect(backupPath).not.toBeNull();
    const backupContents = await readFile(backupPath as string, 'utf8');
    expect(backupContents).toBe('original content');
  });
});

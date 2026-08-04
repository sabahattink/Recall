import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import {
  canCreateFileSymlinks,
  createDirLink,
  createTempDir,
  removeTempDir,
} from '@recall-ai/test-fixtures';
import {
  assertWithinRoot,
  atomicWriteFile,
  backupIfExists,
  PathTraversalError,
  RECALL_DIR_NAME,
  SymlinkWriteError,
} from '../safe-fs.js';

// Probed once at collection time so the OS-capability-dependent test below
// can be skipped with a clear, self-explanatory name instead of silently
// passing. The security guarantee it would exercise is still verified on
// every OS by the mocked-lstat unit test in symlink-rejection.test.ts.
const fileSymlinksSupported = await canCreateFileSymlinks();

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

  it.skipIf(!fileSymlinksSupported)(
    'refuses to write through an existing symlink (skipped: this OS account cannot create file symlinks)',
    async () => {
      const realFile = join(dir, 'real.md');
      await atomicWriteFile(realFile, 'real');
      const linkPath = join(dir, 'link.md');
      await symlink(realFile, linkPath);

      await expect(atomicWriteFile(linkPath, 'malicious')).rejects.toThrow(/symlink/);
    },
  );
});

describe('atomicWriteFile with allowedRoot (repository-root containment)', () => {
  let root: string;
  let outsideDir: string;

  beforeEach(async () => {
    root = await createTempDir('recall-root-');
    outsideDir = await createTempDir('recall-outside-');
  });

  afterEach(async () => {
    await removeTempDir(root);
    await removeTempDir(outsideDir);
  });

  it('writes through a clean, symlink-free directory chain and creates missing directories', async () => {
    const target = join(root, RECALL_DIR_NAME, 'snapshots', 'latest.json');
    await atomicWriteFile(target, '{}', { allowedRoot: root });
    expect(await readFile(target, 'utf8')).toBe('{}');
  });

  it('rejects a symlinked .recall directory', async () => {
    // .recall itself is a symlink (or, on Windows, a directory junction)
    // pointing outside the repository root.
    await createDirLink(outsideDir, join(root, RECALL_DIR_NAME));

    const target = join(root, RECALL_DIR_NAME, 'manifest.json');
    await expect(atomicWriteFile(target, '{}', { allowedRoot: root })).rejects.toThrow(
      SymlinkWriteError,
    );

    // Nothing should have been written through the symlink.
    await expect(readFile(join(outsideDir, 'manifest.json'), 'utf8')).rejects.toThrow();
  });

  it('rejects a symlink planted deeper in the parent chain (not just .recall itself)', async () => {
    await mkdir(join(root, RECALL_DIR_NAME), { recursive: true });
    // `.recall/snapshots` is a symlink/junction, `.recall` itself is a real directory.
    await createDirLink(outsideDir, join(root, RECALL_DIR_NAME, 'snapshots'));

    const target = join(root, RECALL_DIR_NAME, 'snapshots', 'latest.json');
    await expect(atomicWriteFile(target, '{}', { allowedRoot: root })).rejects.toThrow(
      SymlinkWriteError,
    );
    await expect(readFile(join(outsideDir, 'latest.json'), 'utf8')).rejects.toThrow();
  });

  it('rejects a write that lexically escapes the allowed root', async () => {
    await expect(
      atomicWriteFile('../../etc/passwd', 'pwned', { allowedRoot: join(root, RECALL_DIR_NAME) }),
    ).rejects.toThrow(PathTraversalError);
  });

  it('rejects when a parent segment exists but is a plain file, not a directory', async () => {
    await writeFile(join(root, 'blocker'), 'not a directory', 'utf8');
    const target = join(root, 'blocker', 'nested', 'file.md');
    await expect(atomicWriteFile(target, 'x', { allowedRoot: root })).rejects.toThrow(
      SymlinkWriteError,
    );
  });

  it('atomically replaces an existing file at the target path', async () => {
    const target = join(root, RECALL_DIR_NAME, 'manifest.json');
    await atomicWriteFile(target, 'first', { allowedRoot: root });
    await atomicWriteFile(target, 'second', { allowedRoot: root });
    expect(await readFile(target, 'utf8')).toBe('second');
  });

  it('allows an explicit output path (no allowedRoot) to be written outside any repository root', async () => {
    // Simulates `recall scan --output <path>`: an explicit destination the
    // user chose is intentionally exempt from root containment.
    const target = join(outsideDir, 'snapshot.json');
    await atomicWriteFile(target, '{}');
    expect(await readFile(target, 'utf8')).toBe('{}');
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

  it('backs up a real .recall-managed file into .recall/backups', async () => {
    const target = join(dir, RECALL_DIR_NAME, 'architecture.md');
    await atomicWriteFile(target, 'v1', { allowedRoot: dir });
    const backupPath = await backupIfExists(dir, target);
    expect(backupPath).not.toBeNull();
    expect(backupPath).toContain(join(RECALL_DIR_NAME, 'backups'));
    expect(await readFile(backupPath as string, 'utf8')).toBe('v1');
  });

  it('refuses to back up through a symlinked .recall directory', async () => {
    const outsideDir = await createTempDir('recall-outside-');
    try {
      await mkdir(join(dir, RECALL_DIR_NAME), { recursive: true });
      await writeFile(join(dir, RECALL_DIR_NAME, 'architecture.md'), 'v1', 'utf8');
      // Replace .recall's backups directory with a symlink/junction after the fact.
      await createDirLink(outsideDir, join(dir, RECALL_DIR_NAME, 'backups'));

      await expect(
        backupIfExists(dir, join(dir, RECALL_DIR_NAME, 'architecture.md')),
      ).rejects.toThrow(SymlinkWriteError);
    } finally {
      await removeTempDir(outsideDir);
    }
  });
});

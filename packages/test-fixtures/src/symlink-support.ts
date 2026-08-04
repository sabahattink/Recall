import { symlink, unlink, writeFile } from 'node:fs/promises';
import { platform } from 'node:os';
import { join } from 'node:path';
import { createTempDir, removeTempDir } from './temp-dir.js';

let fileSymlinkCapability: Promise<boolean> | undefined;

/**
 * Creates a directory-to-directory link suitable for exercising a symlink
 * security boundary on the current OS. On Windows this uses an NTFS
 * junction, which (unlike a symlink) a non-elevated, non-Developer-Mode
 * process is allowed to create, and which `fs.lstat().isSymbolicLink()`
 * reports as true — the same signal Recall's safe-fs guards check for real
 * symlinks. On Linux/macOS this creates a real symbolic link.
 */
export async function createDirLink(target: string, linkPath: string): Promise<void> {
  await symlink(target, linkPath, platform() === 'win32' ? 'junction' : undefined);
}

/**
 * Detects whether the current process can create real file symlinks.
 * Non-elevated Windows accounts without Developer Mode enabled get EPERM
 * when calling `fs.symlink` on a file (directory junctions are unaffected
 * by this restriction). The result is probed once and cached.
 */
export async function canCreateFileSymlinks(): Promise<boolean> {
  if (platform() !== 'win32') return true;
  if (!fileSymlinkCapability) {
    fileSymlinkCapability = probeFileSymlinkSupport();
  }
  return fileSymlinkCapability;
}

async function probeFileSymlinkSupport(): Promise<boolean> {
  const dir = await createTempDir('recall-symlink-probe-');
  try {
    const target = join(dir, 'target.txt');
    const link = join(dir, 'link.txt');
    await writeFile(target, 'probe', 'utf8');
    await symlink(target, link);
    await unlink(link);
    return true;
  } catch {
    return false;
  } finally {
    await removeTempDir(dir);
  }
}

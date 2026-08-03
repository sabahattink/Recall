import { mkdir, readFile, rename, writeFile, lstat, unlink } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

export class PathTraversalError extends Error {
  constructor(path: string) {
    super(`Refusing to write outside the allowed root: ${path}`);
    this.name = 'PathTraversalError';
  }
}

/**
 * Throws if `targetPath` would resolve outside of `allowedRoot`. This is the
 * single guard every Recall write path goes through, since Recall must never
 * modify files outside `.recall`, `.gitignore`, or an explicit user-provided
 * output path.
 */
export function assertWithinRoot(allowedRoot: string, targetPath: string): string {
  const resolvedRoot = resolve(allowedRoot);
  const resolvedTarget = resolve(allowedRoot, targetPath);
  const rel = relative(resolvedRoot, resolvedTarget);
  if (rel.startsWith('..') || resolve(resolvedRoot, rel) !== resolvedTarget) {
    throw new PathTraversalError(resolvedTarget);
  }
  return resolvedTarget;
}

async function isSymlink(path: string): Promise<boolean> {
  try {
    const stats = await lstat(path);
    return stats.isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * Writes `contents` to `path` atomically: the data is written to a sibling
 * temp file and then renamed into place, so a crash or concurrent read never
 * observes a partially written file. Refuses to write through an existing
 * symlink so Recall can never be tricked into writing outside its allowed
 * roots via a symlinked memory file.
 */
export async function atomicWriteFile(path: string, contents: string): Promise<void> {
  if (await isSymlink(path)) {
    throw new Error(`Refusing to write through a symlink: ${path}`);
  }
  await mkdir(dirname(path), { recursive: true });
  const tempPath = `${path}.tmp-${randomBytes(6).toString('hex')}`;
  await writeFile(tempPath, contents, 'utf8');
  await rename(tempPath, path);
}

export async function readFileIfExists(path: string): Promise<string | null> {
  try {
    if (await isSymlink(path)) return null;
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Copies the current contents of a Recall-managed file into
 * `<recallDir>/backups/` before it is overwritten, so `--force` or a
 * regenerated section can never silently destroy prior content.
 */
export async function backupIfExists(recallDir: string, path: string): Promise<string | null> {
  const existing = await readFileIfExists(path);
  if (existing === null) return null;
  const relativeName = relative(recallDir, path).split('/').join('__') || 'file';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = resolve(recallDir, 'backups', `${relativeName}.${timestamp}.bak`);
  await mkdir(dirname(backupPath), { recursive: true });
  await writeFile(backupPath, existing, 'utf8');
  return backupPath;
}

export async function removeIfExists(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    // Already absent; nothing to clean up.
  }
}

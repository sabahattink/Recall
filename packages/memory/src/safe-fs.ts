import { mkdir, readFile, rename, writeFile, lstat, unlink, realpath } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { randomBytes } from 'node:crypto';

/** Name of the directory Recall writes its memory into, relative to a repository root. */
export const RECALL_DIR_NAME = '.recall';

export class PathTraversalError extends Error {
  constructor(path: string) {
    super(`Refusing to write outside the allowed root: ${path}`);
    this.name = 'PathTraversalError';
  }
}

export class SymlinkWriteError extends Error {
  constructor(path: string, reason: string) {
    super(`Refusing to write through a symlink at "${path}": ${reason}`);
    this.name = 'SymlinkWriteError';
  }
}

/**
 * Throws if `targetPath` would resolve outside of `allowedRoot`, using plain
 * lexical resolution (no symlink following). This is a cheap fast-path check
 * only; it does not by itself defend against a symlinked ancestor directory
 * redirecting the real write elsewhere on disk. `atomicWriteFile`'s
 * `allowedRoot` option performs the full realpath-based validation and
 * should be preferred for anything that writes to disk.
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

async function lstatSafe(path: string) {
  try {
    return await lstat(path);
  } catch {
    return null;
  }
}

async function isSymlink(path: string): Promise<boolean> {
  const stats = await lstatSafe(path);
  return stats?.isSymbolicLink() ?? false;
}

/**
 * Walks every path segment from `realRoot` down to (but not including) the
 * final path component of `relativeDir`, rejecting the whole operation if
 * any *existing* segment is a symlink or otherwise not a plain directory.
 * Missing segments are created one at a time as plain directories, never by
 * recursing "through" an existing symlink.
 *
 * This is what prevents a symlinked `.recall` directory — or a symlink
 * planted at any deeper level inside it — from silently redirecting a
 * write outside of `realRoot`. `.recall` itself is just one of the
 * segments walked here, so rejecting it needs no special case.
 */
async function ensureSafeDirectoryChain(realRoot: string, relativeDir: string): Promise<string> {
  let current = realRoot;
  const segments = relativeDir.split(sep).filter(Boolean);

  for (const segment of segments) {
    current = join(current, segment);
    const stats = await lstatSafe(current);

    if (stats) {
      if (stats.isSymbolicLink()) {
        throw new SymlinkWriteError(current, 'directory segment is a symlink');
      }
      if (!stats.isDirectory()) {
        throw new SymlinkWriteError(current, 'path segment exists but is not a directory');
      }
      continue;
    }

    try {
      await mkdir(current);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      // Lost a race with a concurrent creation; re-validate rather than trust it.
      const recheck = await lstatSafe(current);
      if (!recheck || recheck.isSymbolicLink() || !recheck.isDirectory()) {
        throw new SymlinkWriteError(
          current,
          'path segment changed concurrently to an unsafe target',
        );
      }
    }
  }

  return current;
}

/**
 * Resolves `path` to a real, on-disk location guaranteed to sit inside
 * `allowedRoot`, creating any missing ancestor directories safely along the
 * way. Throws `PathTraversalError`/`SymlinkWriteError` if that can't be
 * guaranteed — including when `allowedRoot` itself, `.recall`, or any
 * directory beneath it is (or has become) a symlink.
 */
async function resolveSafeWriteTarget(path: string, allowedRoot: string): Promise<string> {
  // Cheap lexical pre-check before touching the filesystem.
  assertWithinRoot(allowedRoot, path);

  let realRoot: string;
  try {
    realRoot = await realpath(allowedRoot);
  } catch (error) {
    throw new PathTraversalError(
      `${allowedRoot} (could not resolve real path: ${
        error instanceof Error ? error.message : String(error)
      })`,
    );
  }

  const resolvedRoot = resolve(allowedRoot);
  const resolvedTarget = resolve(allowedRoot, path);
  const relativeDir = relative(resolvedRoot, dirname(resolvedTarget));

  const safeRealDir = await ensureSafeDirectoryChain(realRoot, relativeDir);

  // Defense in depth: confirm the directory we just safely built still
  // resolves inside realRoot. `ensureSafeDirectoryChain` already rejects any
  // symlink it encounters, so this mainly guards the narrow window between
  // creating a segment and this check (e.g. a concurrent process replacing
  // it with a symlink).
  const realCheck = await realpath(safeRealDir);
  const relCheck = relative(realRoot, realCheck);
  if (relCheck.startsWith('..') || resolve(realRoot, relCheck) !== realCheck) {
    throw new PathTraversalError(realCheck);
  }

  return join(safeRealDir, basename(resolvedTarget));
}

const RENAME_RETRY_DELAYS_MS = [25, 75, 150];

/**
 * Renames `tempPath` to `finalPath`, retrying a few times with backoff on
 * `EPERM`/`EBUSY`/`EACCES`. POSIX `rename()` atomically replaces an existing
 * destination and essentially never hits this; Windows can transiently
 * refuse to replace a file that's momentarily held open by another process
 * (an antivirus scan, a search indexer, an editor's file watcher), so a
 * short retry loop avoids turning that into a hard failure while keeping
 * the replace itself atomic (each attempt is a single rename call, never a
 * separate delete-then-write).
 */
async function renameWithRetry(tempPath: string, finalPath: string): Promise<void> {
  for (let attempt = 0; attempt <= RENAME_RETRY_DELAYS_MS.length; attempt++) {
    try {
      await rename(tempPath, finalPath);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      const retryable = code === 'EPERM' || code === 'EBUSY' || code === 'EACCES';
      if (!retryable || attempt === RENAME_RETRY_DELAYS_MS.length) {
        await unlink(tempPath).catch(() => {});
        throw error;
      }
      const delay = RENAME_RETRY_DELAYS_MS[attempt] as number;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
    }
  }
}

export interface AtomicWriteOptions {
  /**
   * Repository root the write must stay within. When provided, every
   * directory segment between the root and the target is validated (see
   * `ensureSafeDirectoryChain`) and the final path is confirmed to resolve
   * inside the root's real, symlink-free path.
   *
   * Omit only for a path the user explicitly supplied (e.g.
   * `recall scan --output <path>`), which is intentionally exempt from
   * root containment — Recall trusts an explicit destination the same way
   * any other CLI's `-o`/`--output` flag would be trusted. The write still
   * refuses to go through a symlink at the destination itself.
   */
  allowedRoot?: string;
}

/**
 * Writes `contents` to `path` atomically: the data is written to a sibling
 * temp file and then renamed into place, so a crash or concurrent read
 * never observes a partially written file.
 */
export async function atomicWriteFile(
  path: string,
  contents: string,
  options: AtomicWriteOptions = {},
): Promise<void> {
  let finalPath = path;

  if (options.allowedRoot) {
    finalPath = await resolveSafeWriteTarget(path, options.allowedRoot);
  } else {
    await mkdir(dirname(path), { recursive: true });
  }

  if (await isSymlink(finalPath)) {
    throw new SymlinkWriteError(finalPath, 'refusing to write through an existing symlink');
  }

  const tempPath = `${finalPath}.tmp-${randomBytes(6).toString('hex')}`;
  await writeFile(tempPath, contents, 'utf8');
  await renameWithRetry(tempPath, finalPath);
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
 * `<root>/.recall/backups/` before it is overwritten, so `--force` or a
 * regenerated section can never silently destroy prior content. Routed
 * through `atomicWriteFile`'s root-validated path so a backup write is held
 * to the same symlink/containment guarantees as any other Recall write.
 */
export async function backupIfExists(root: string, path: string): Promise<string | null> {
  const existing = await readFileIfExists(path);
  if (existing === null) return null;

  const recallDir = join(root, RECALL_DIR_NAME);
  const relativeName = relative(recallDir, path).split(sep).join('__') || 'file';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupRelativePath = join(RECALL_DIR_NAME, 'backups', `${relativeName}.${timestamp}.bak`);

  await atomicWriteFile(backupRelativePath, existing, { allowedRoot: root });
  return join(root, backupRelativePath);
}

export async function removeIfExists(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    // Already absent; nothing to clean up.
  }
}

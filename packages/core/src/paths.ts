import { access, lstat, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { RECALL_DIR_NAME } from '@recall-ai/memory';
import { InvalidStateError, InvalidUsageError } from './errors.js';

export { RECALL_DIR_NAME };

export async function resolveRepositoryRoot(inputPath: string): Promise<string> {
  const root = resolve(inputPath);
  let stats;
  try {
    stats = await stat(root);
  } catch {
    throw new InvalidUsageError(`Path does not exist: ${root}`);
  }
  if (!stats.isDirectory()) {
    throw new InvalidUsageError(`Path is not a directory: ${root}`);
  }
  try {
    await access(root);
  } catch {
    throw new InvalidUsageError(`Path is not accessible: ${root}`);
  }
  return root;
}

export function recallDirFor(root: string): string {
  return join(root, RECALL_DIR_NAME);
}

export async function recallDirExists(root: string): Promise<boolean> {
  try {
    const stats = await stat(recallDirFor(root));
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/** True if `.recall` exists and is itself a symlink, which Recall refuses to write through. */
export async function recallDirIsSymlink(root: string): Promise<boolean> {
  try {
    const stats = await lstat(recallDirFor(root));
    return stats.isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * Fails fast, with a clear error, when `.recall` exists but is a symlink.
 * The lower-level write path (`atomicWriteFile`'s `allowedRoot` option)
 * would also reject this, but checking here first turns it into a clean
 * `InvalidStateError` (exit code 3) instead of a lower-level filesystem
 * error surfacing from deep inside a write.
 */
export async function assertRecallDirNotSymlink(root: string): Promise<void> {
  if (await recallDirIsSymlink(root)) {
    throw new InvalidStateError(
      `${recallDirFor(root)} exists but is a symlink. Recall refuses to read or write through a symlinked .recall directory — replace it with a real directory (or remove it) and re-run.`,
    );
  }
}

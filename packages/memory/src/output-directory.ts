import { lstat, mkdir, open, realpath, rename, rm } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';

/** The one directory Recall writes to (docs/product-specification.md §6, §20). */
export const RECALL_DIR_NAME = '.recall';

/**
 * Sibling directories the output is staged through. Both start with
 * `.recall` so the Scanner's `.recall*` exclusion skips any a crash leaves
 * behind, and both are removed again before `writeRecallDirectory` returns.
 */
const STAGING_PREFIX = `${RECALL_DIR_NAME}.staging-`;
const PREVIOUS_PREFIX = `${RECALL_DIR_NAME}.previous-`;

/**
 * A relative output path: lowercase segments of `[a-z0-9._-]`, separated by
 * `/`, each starting with a letter or digit — which rules out `..`,
 * absolute paths, drive letters, and backslashes on every platform.
 */
const OUTPUT_PATH_PATTERN = /^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)*$/;

export class RecallDirectoryExistsError extends Error {
  constructor(readonly path: string) {
    super(`${path} already exists`);
    this.name = 'RecallDirectoryExistsError';
  }
}

export class UnsafeOutputLocationError extends Error {
  constructor(
    readonly path: string,
    reason: string,
  ) {
    super(`Refusing to write to ${path}: ${reason}`);
    this.name = 'UnsafeOutputLocationError';
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export type RecallDirectoryState = 'absent' | 'directory' | 'symlink' | 'not-a-directory';

/**
 * What currently occupies `<root>/.recall`, read with `lstat` so a symlink
 * is reported as a symlink rather than as whatever it points at.
 */
export async function inspectRecallDirectory(root: string): Promise<RecallDirectoryState> {
  try {
    const stats = await lstat(join(root, RECALL_DIR_NAME));
    if (stats.isSymbolicLink()) return 'symlink';
    return stats.isDirectory() ? 'directory' : 'not-a-directory';
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'absent';
    throw error;
  }
}

const RENAME_RETRY_DELAYS_MS = [25, 75, 150, 300];

/**
 * `rename` with a short backoff on `EPERM`/`EBUSY`/`EACCES`. POSIX
 * essentially never hits these; Windows transiently refuses to rename a
 * directory while another process (an antivirus scan, a search indexer, an
 * editor's file watcher) briefly holds a handle inside it. Each attempt is
 * still a single atomic rename — never a copy, never a delete-then-write.
 */
export async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      const retryable = code === 'EPERM' || code === 'EBUSY' || code === 'EACCES';
      const delay = RENAME_RETRY_DELAYS_MS[attempt];
      if (!retryable || delay === undefined) throw error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
    }
  }
}

export interface OutputFile {
  /** Path relative to `.recall/`, `/`-separated, e.g. `agents/claude.md`. */
  path: string;
  contents: string;
}

export interface WriteRecallDirectoryOptions {
  /** Replace an existing `.recall/` instead of refusing. */
  force: boolean;
}

function assertValidOutputFiles(files: OutputFile[]): void {
  const seen = new Set<string>();
  for (const file of files) {
    if (!OUTPUT_PATH_PATTERN.test(file.path)) {
      throw new UnsafeOutputLocationError(file.path, 'not a plain relative output path');
    }
    if (seen.has(file.path)) {
      throw new UnsafeOutputLocationError(file.path, 'listed more than once');
    }
    seen.add(file.path);
  }
}

async function writeDurably(path: string, contents: string): Promise<void> {
  // 'wx' fails if anything already exists at `path` — inside a directory
  // this process just created, that can only mean interference.
  const handle = await open(path, 'wx');
  try {
    await handle.writeFile(contents, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

/** A fresh sibling path for staging or setting aside a directory. */
function uniqueSibling(realRoot: string, prefix: string): string {
  return join(realRoot, `${prefix}${randomBytes(8).toString('hex')}`);
}

/**
 * Creates the staging directory with a non-recursive `mkdir`, which fails
 * if anything (including a symlink) already exists at the path and never
 * follows one — the same guarantee `mkdtemp` gives, but with the default
 * permissions (0o777 minus the umask) instead of `mkdtemp`'s 0o700, which
 * would otherwise become the permissions of `.recall/` itself after the
 * rename and hide it from other users, containers, and CI service accounts.
 */
async function writeStagingDirectory(realRoot: string, files: OutputFile[]): Promise<string> {
  const staging = uniqueSibling(realRoot, STAGING_PREFIX);
  await mkdir(staging);
  try {
    for (const file of files) {
      const target = join(staging, ...file.path.split('/'));
      await mkdir(dirname(target), { recursive: true });
      await writeDurably(target, file.contents);
    }
    return staging;
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

async function assertReplaceable(target: string, force: boolean): Promise<boolean> {
  const state = await inspectRecallDirectory(dirname(target));
  if (state === 'symlink') {
    throw new UnsafeOutputLocationError(target, 'it is a symlink, which could redirect the write');
  }
  if (state === 'not-a-directory') {
    throw new UnsafeOutputLocationError(target, 'it exists and is not a directory');
  }
  if (state === 'directory' && !force) throw new RecallDirectoryExistsError(target);
  return state === 'directory';
}

async function swapInto(staging: string, target: string, replaceExisting: boolean): Promise<void> {
  if (!replaceExisting) {
    await renameWithRetry(staging, target);
    return;
  }

  const previous = uniqueSibling(dirname(target), PREVIOUS_PREFIX);
  await renameWithRetry(target, previous);
  try {
    await renameWithRetry(staging, target);
  } catch (error) {
    // Put the original back so a failed --force leaves the repository as it was.
    try {
      await renameWithRetry(previous, target);
    } catch (restoreError) {
      throw new Error(
        `Could not replace ${target} (${describe(error)}), and restoring the previous copy from ${previous} also failed (${describe(restoreError)}). Rename ${previous} back to ${target} by hand.`,
      );
    }
    throw error;
  }
  try {
    await rm(previous, { recursive: true, force: true, maxRetries: 3 });
  } catch (error) {
    throw new Error(
      `${target} was regenerated, but the previous copy at ${previous} could not be removed: ${describe(error)}`,
    );
  }
}

/**
 * Writes Recall's complete output as a single unit (MEM-04, CLI-03): every
 * file is written and flushed into a fresh staging directory next to
 * `.recall/`, which is then renamed into place. A reader therefore sees
 * either no `.recall/`, the previous `.recall/`, or the complete new one —
 * never a partially written file or a partial set of files (spec §20,
 * "No silent partial success"). Any failure removes the staging directory
 * and leaves the repository exactly as it was.
 *
 * With `force`, an existing `.recall/` is moved aside, the new one renamed
 * in, and only then is the old copy deleted; if the second rename fails the
 * old copy is moved back. Without `force`, an existing `.recall/` raises
 * `RecallDirectoryExistsError` and nothing is written.
 *
 * Symlink protection: a `.recall` that is a symlink (or a Windows junction)
 * is always refused, with or without `force`, since writing through it
 * could place files anywhere on disk. Staging directories are created with
 * an exclusive `mkdir`, which never follows or reuses an existing path. The final
 * rename cannot be redirected either: renaming a directory onto a path that
 * has since become a symlink fails rather than following it.
 */
export async function writeRecallDirectory(
  root: string,
  files: OutputFile[],
  options: WriteRecallDirectoryOptions,
): Promise<string> {
  assertValidOutputFiles(files);
  const realRoot = await realpath(root);
  const target = join(realRoot, RECALL_DIR_NAME);

  await assertReplaceable(target, options.force);
  const staging = await writeStagingDirectory(realRoot, files);
  try {
    const replaceExisting = await assertReplaceable(target, options.force);
    await swapInto(staging, target, replaceExisting);
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
  return target;
}

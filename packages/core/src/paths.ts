import { access, constants, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { InvalidPathError } from './errors.js';

/**
 * Resolves the user-supplied repository path to an absolute directory,
 * failing with `InvalidPathError` before any scanning begins (CLI-01).
 */
export async function resolveRepositoryRoot(inputPath: string): Promise<string> {
  const root = resolve(inputPath);
  let stats;
  try {
    stats = await stat(root);
  } catch {
    throw new InvalidPathError(`Path does not exist: ${root}`);
  }
  if (!stats.isDirectory()) {
    throw new InvalidPathError(`Path is not a directory: ${root}`);
  }
  try {
    await access(root, constants.R_OK);
  } catch {
    throw new InvalidPathError(`Path is not readable: ${root}`);
  }
  return root;
}

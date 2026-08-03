import { access, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { InvalidUsageError } from './errors.js';

export const RECALL_DIR_NAME = '.recall';

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

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Every file under `dir` mapped to its contents, keyed by `/`-separated
 * relative path in sorted order — a complete, comparable picture of a
 * directory tree for "nothing else changed" and golden assertions.
 */
export async function snapshotTree(dir: string, prefix = ''): Promise<Record<string, string>> {
  const entries = (await readdir(dir, { withFileTypes: true })).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  const result: Record<string, string> = {};
  for (const entry of entries) {
    const relativePath = `${prefix}${entry.name}`;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      Object.assign(result, await snapshotTree(fullPath, `${relativePath}/`));
    } else {
      result[relativePath] = await readFile(fullPath, 'utf8');
    }
  }
  return result;
}

/** The subset of a tree snapshot outside `.recall/`. */
export function withoutRecallDirectory(tree: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(tree).filter(([path]) => !path.startsWith('.recall/')));
}

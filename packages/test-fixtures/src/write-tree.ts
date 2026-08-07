import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * A FileTree maps relative file paths to their string contents. Nested
 * directories are created implicitly. Fixture builders describe entire
 * projects this way so the resulting tree is easy to read and diff in tests.
 */
export type FileTree = Record<string, string>;

export async function writeTree(root: string, tree: FileTree): Promise<void> {
  // Each entry is an independent file write; `mkdir(..., { recursive: true })`
  // is idempotent under concurrent calls, so there's no ordering requirement
  // between entries. Running them in parallel (rather than one at a time)
  // cuts wall-clock I/O time on filesystems with higher per-call latency,
  // such as Windows CI runners.
  await Promise.all(
    Object.entries(tree).map(async ([relativePath, contents]) => {
      const fullPath = join(root, relativePath);
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, contents, 'utf8');
    }),
  );
}

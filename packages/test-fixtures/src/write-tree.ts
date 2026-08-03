import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * A FileTree maps relative file paths to their string contents. Nested
 * directories are created implicitly. Fixture builders describe entire
 * projects this way so the resulting tree is easy to read and diff in tests.
 */
export type FileTree = Record<string, string>;

export async function writeTree(root: string, tree: FileTree): Promise<void> {
  for (const [relativePath, contents] of Object.entries(tree)) {
    const fullPath = join(root, relativePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, contents, 'utf8');
  }
}

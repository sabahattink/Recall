import { join } from 'node:path';
import { atomicWriteFile, readFileIfExists } from './safe-fs.js';

const IGNORE_ENTRY = '.recall/cache/';
const MARKER_COMMENT = '# Recall (local memory cache; safe to regenerate)';

export interface GitignoreUpdateResult {
  changed: boolean;
  path: string;
}

/**
 * Ensures `.recall/cache/` is excluded from version control. `.recall/`
 * itself (manifest, snapshots, generated Markdown) is meant to be committed;
 * only its cache subdirectory is transient, so it is the only part ignored.
 */
export async function ensureRecallCacheIgnored(root: string): Promise<GitignoreUpdateResult> {
  const path = join(root, '.gitignore');
  const existing = await readFileIfExists(path);

  if (existing !== null && containsEntry(existing, IGNORE_ENTRY)) {
    return { changed: false, path };
  }

  const nextContent =
    existing === null
      ? `${MARKER_COMMENT}\n${IGNORE_ENTRY}\n`
      : `${existing.replace(/\n?$/, '\n')}\n${MARKER_COMMENT}\n${IGNORE_ENTRY}\n`;

  await atomicWriteFile(path, nextContent, { allowedRoot: root });
  return { changed: true, path };
}

function containsEntry(content: string, entry: string): boolean {
  return (
    content
      .split('\n')
      .map((line) => line.trim())
      .includes(entry.replace(/\/$/, '')) || content.includes(entry)
  );
}

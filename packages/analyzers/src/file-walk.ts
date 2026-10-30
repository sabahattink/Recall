import fg from 'fast-glob';
import type { Ignore } from 'ignore';
import { stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, relative } from 'node:path';

// `ignore` ships a CJS default export shaped as a callable factory function.
// TypeScript's NodeNext interop cannot resolve that shape as a default import
// (it types the module as a non-callable namespace), so it is loaded via
// `createRequire` instead, which matches the package's actual runtime shape.
const require = createRequire(import.meta.url);
const ignoreFactory: (options?: unknown) => Ignore = require('ignore');
import {
  DEFAULT_IGNORED_DIRECTORIES,
  DEFAULT_MAX_FILES,
  RECALL_OUTPUT_DIRECTORY_GLOB,
} from './constants.js';
import { compareStrings } from '@recall-ai/schemas';
import { collectTruncated } from './file-walk-internal.js';
import { readTextIfExists } from './json.js';

export interface WalkedFile {
  /** Path relative to the repository root, using forward slashes. */
  path: string;
  sizeBytes: number;
  extension: string;
}

export interface FileWalkOptions {
  maxFiles?: number;
}

export interface FileWalkResult {
  files: WalkedFile[];
  truncated: boolean;
}

async function loadGitignore(root: string): Promise<string[]> {
  const contents = await readTextIfExists(join(root, '.gitignore'));
  return contents === null ? [] : contents.split(/\r?\n/);
}

/**
 * Walks the repository, skipping unsafe/irrelevant directories and
 * respecting `.gitignore`. Symlinks are never followed, which also
 * satisfies the requirement to never traverse outside the repository root
 * through a symlink.
 *
 * Uses `fast-glob`'s streaming API (rather than collecting the whole match
 * set into an array first) so that a scan capped by `maxFiles` on a very
 * large repository actually stops walking the filesystem once the cap is
 * reached, instead of enumerating every entry before the cap is ever
 * checked. `truncated` signals when that happened.
 *
 * Determinism trade-off: when a scan is *not* truncated (the common case —
 * the repository has fewer than `maxFiles` matching files), the result is
 * collected in full and sorted, so it is exactly as deterministic as
 * before: two scans of an unchanged repository produce identical output.
 * When a scan *is* truncated, the specific set of included files depends on
 * filesystem enumeration order rather than being guaranteed to be the
 * lexicographically-first `maxFiles` paths — the truncated result is still
 * internally sorted for readability, but which files made the cut can vary
 * by filesystem. A truncated scan is never silent: the Scanner turns it
 * into a `file-limit-reached` risk indicator, so the generated memory says
 * plainly that it is incomplete. This is considered an acceptable trade for
 * bounding the actual filesystem work on huge repositories.
 */
export async function walkRepository(
  root: string,
  options: FileWalkOptions = {},
): Promise<FileWalkResult> {
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const gitignoreLines = await loadGitignore(root);
  const ig = ignoreFactory().add(gitignoreLines);

  const ignorePatterns = [
    ...DEFAULT_IGNORED_DIRECTORIES.map((dir) => `**/${dir}/**`),
    RECALL_OUTPUT_DIRECTORY_GLOB,
  ];

  const stream = fg.stream('**/*', {
    cwd: root,
    dot: true,
    onlyFiles: true,
    followSymbolicLinks: false,
    ignore: ignorePatterns,
    stats: false,
  });

  async function* stringEntries(): AsyncGenerator<string> {
    for await (const chunk of stream) {
      yield String(chunk);
    }
  }

  // Collect one entry beyond the limit: a repository with exactly
  // `maxFiles` files is complete, not truncated.
  const collected = await collectTruncated(
    stringEntries(),
    (entry) => ig.ignores(entry),
    maxFiles + 1,
  );
  const truncated = collected.matchedEntries.length > maxFiles;
  const matchedEntries = collected.matchedEntries.slice(0, maxFiles).sort(compareStrings);

  const files: WalkedFile[] = [];
  for (const entry of matchedEntries) {
    try {
      const absolutePath = join(root, entry);
      const info = await stat(absolutePath);
      if (!info.isFile()) continue;
      files.push({
        path: relative(root, absolutePath).split('\\').join('/'),
        sizeBytes: info.size,
        extension: extname(entry),
      });
    } catch {
      // File may have been removed between listing and stat; skip safely.
      continue;
    }
  }

  return { files, truncated };
}

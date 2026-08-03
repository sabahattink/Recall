import fg from 'fast-glob';
import type { Ignore } from 'ignore';
import { readFile, stat } from 'node:fs/promises';
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
  DEFAULT_MAX_FILE_SIZE_BYTES,
} from './constants.js';

export interface WalkedFile {
  /** Path relative to the repository root, using forward slashes. */
  path: string;
  sizeBytes: number;
  extension: string;
}

export interface FileWalkOptions {
  maxFiles?: number;
  maxFileSizeBytes?: number;
  extraIgnoredDirectories?: string[];
}

export interface FileWalkResult {
  files: WalkedFile[];
  truncated: boolean;
}

async function loadGitignore(root: string): Promise<string[]> {
  try {
    const contents = await readFile(join(root, '.gitignore'), 'utf8');
    return contents.split('\n');
  } catch {
    return [];
  }
}

/**
 * Walks the repository deterministically (sorted by path), skipping
 * unsafe/irrelevant directories and respecting `.gitignore`. Symlinks are
 * never followed, which also satisfies the requirement to never traverse
 * outside the repository root through a symlink. Results are capped by
 * `maxFiles` so large repositories stay responsive; `truncated` signals when
 * the cap was hit.
 */
export async function walkRepository(
  root: string,
  options: FileWalkOptions = {},
): Promise<FileWalkResult> {
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const maxFileSizeBytes = options.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES;
  const ignoredDirs = new Set([
    ...DEFAULT_IGNORED_DIRECTORIES,
    ...(options.extraIgnoredDirectories ?? []),
  ]);

  const gitignoreLines = await loadGitignore(root);
  const ig = ignoreFactory().add(gitignoreLines);

  const ignorePatterns = [...ignoredDirs].map((dir) => `**/${dir}/**`);

  const entries = await fg('**/*', {
    cwd: root,
    dot: true,
    onlyFiles: true,
    followSymbolicLinks: false,
    ignore: ignorePatterns,
    stats: false,
  });

  entries.sort((a, b) => a.localeCompare(b));

  const files: WalkedFile[] = [];
  let truncated = false;

  for (const entry of entries) {
    if (ig.ignores(entry)) continue;
    if (files.length >= maxFiles) {
      truncated = true;
      break;
    }
    try {
      const absolutePath = join(root, entry);
      const info = await stat(absolutePath);
      if (!info.isFile()) continue;
      files.push({
        path: relative(root, absolutePath).split('\\').join('/'),
        sizeBytes: info.size,
        extension: extname(entry),
      });
      if (info.size > maxFileSizeBytes) {
        // Recorded with metadata only; callers must not read contents of
        // files flagged this large.
      }
    } catch {
      // File may have been removed between listing and stat; skip safely.
      continue;
    }
  }

  return { files, truncated };
}

export async function readTextFileSafely(
  path: string,
  maxSizeBytes = DEFAULT_MAX_FILE_SIZE_BYTES,
): Promise<string | null> {
  try {
    const info = await stat(path);
    if (!info.isFile() || info.size > maxSizeBytes) return null;
    const buffer = await readFile(path);
    if (isLikelyBinary(buffer)) return null;
    return buffer.toString('utf8');
  } catch {
    return null;
  }
}

function isLikelyBinary(buffer: Buffer): boolean {
  const sampleSize = Math.min(buffer.length, 8000);
  for (let i = 0; i < sampleSize; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

import type { EntryPoint, FileRecord } from '@recall-ai/schemas';
import { GENERATED_FILE_PATTERN } from './constants.js';

const GENERATED_DIR_NAMES = new Set(['dist', 'build', 'coverage', '.next', 'out']);

/** Preferred source extensions, most-specific first, tried in this order. */
const SOURCE_EXTENSION_PRIORITY = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

function stripExtension(path: string): string {
  const lastDot = path.lastIndexOf('.');
  const lastSlash = path.lastIndexOf('/');
  return lastDot > lastSlash ? path.slice(0, lastDot) : path;
}

/**
 * Maps a generated/built entry point (e.g. `apps/cli/dist/index.js`) back to
 * its likely source counterpart (e.g. `apps/cli/src/index.ts`), when one was
 * actually found among the scanned files — so downstream consumers, task-
 * focused context in particular, can recommend the real, editable file
 * instead of build output that happens to satisfy `package.json`'s `bin`/
 * `main` field.
 *
 * `path` (the real runtime entry point npm/node actually execute) is never
 * changed; only the additional `sourcePath` is populated, and only when a
 * plausible source file exists. If no source counterpart can be found —
 * e.g. a published package with no source shipped — `sourcePath` stays
 * unset and `path` remains the only available information, which is the
 * correct fallback.
 */
export function resolveEntryPointSources(
  entryPoints: EntryPoint[],
  files: FileRecord[],
): EntryPoint[] {
  const knownPaths = new Set(files.map((f) => f.path));

  return entryPoints.map((entry) => {
    // `script`/`framework-convention`/`test-runner` entries already point at
    // a source-ish path (or package.json itself); only `bin`/`main` come
    // from package.json fields that conventionally point at build output.
    if (entry.kind !== 'bin' && entry.kind !== 'main') return entry;
    if (!GENERATED_FILE_PATTERN.test(entry.path)) return entry;

    const segments = entry.path.split('/');
    const generatedIndex = segments.findIndex((segment) => GENERATED_DIR_NAMES.has(segment));
    if (generatedIndex === -1) return entry;

    const workspacePrefix = segments.slice(0, generatedIndex).join('/');
    const buildRelativeStem = stripExtension(segments.slice(generatedIndex + 1).join('/'));

    for (const ext of SOURCE_EXTENSION_PRIORITY) {
      const candidate = [workspacePrefix, 'src', `${buildRelativeStem}${ext}`]
        .filter(Boolean)
        .join('/');
      if (knownPaths.has(candidate)) {
        return { ...entry, sourcePath: candidate };
      }
    }

    return entry;
  });
}

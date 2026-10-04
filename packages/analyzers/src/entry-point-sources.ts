import { join } from 'node:path';
import type { EntryPoint, Evidence, FileRecord } from '@recall-ai/schemas';
import { GENERATED_FILE_PATTERN } from './constants.js';
import { readJsonIfExists } from './json.js';

const GENERATED_DIR_NAMES = new Set(['dist', 'build', 'coverage', '.next', 'out']);

/** Preferred source extensions, most-specific first, tried in this order. */
const SOURCE_EXTENSION_PRIORITY = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

interface TsConfigLike {
  compilerOptions?: {
    rootDir?: string;
    outDir?: string;
  };
}

function toPosix(path: string): string {
  return path.split('\\').join('/').replace(/^\.\//, '').replace(/\/$/, '');
}

function joinPosix(...parts: Array<string | null | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part && part !== '.'))
    .join('/')
    .replace(/\/{2,}/g, '/');
}

function stripExtension(path: string): string {
  const lastDot = path.lastIndexOf('.');
  const lastSlash = path.lastIndexOf('/');
  return lastDot > lastSlash ? path.slice(0, lastDot) : path;
}

function uniqueEvidence(items: Evidence[]): Evidence[] {
  const seen = new Set<string>();
  const result: Evidence[] = [];
  for (const evidence of items) {
    const key = evidence.path + ':' + (evidence.line ?? '') + ':' + evidence.reason;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(evidence);
  }
  return result;
}

async function compilerRoots(
  root: string,
  entry: EntryPoint,
): Promise<{ sourceRoot: string; outputRoot: string | null }> {
  const workspacePath = entry.workspace ?? '.';
  const config = await readJsonIfExists<TsConfigLike>(join(root, workspacePath, 'tsconfig.json'));
  const workspacePrefix = workspacePath === '.' ? '' : toPosix(workspacePath);
  const rootDir = toPosix(config?.compilerOptions?.rootDir ?? 'src');
  const outDir = config?.compilerOptions?.outDir
    ? toPosix(config.compilerOptions.outDir)
    : null;

  return {
    sourceRoot: joinPosix(workspacePrefix, rootDir),
    outputRoot: outDir ? joinPosix(workspacePrefix, outDir) : null,
  };
}

function sourceCandidatesForStem(sourceStem: string): string[] {
  return SOURCE_EXTENSION_PRIORITY.map((ext) => sourceStem + ext);
}

async function resolveOneEntryPoint(
  root: string,
  entry: EntryPoint,
  knownPaths: Set<string>,
): Promise<EntryPoint> {
  if (entry.kind !== 'bin' && entry.kind !== 'main') return entry;

  const runtimePath = toPosix(entry.path);
  const { sourceRoot, outputRoot } = await compilerRoots(root, entry);
  const candidateStems: string[] = [];

  // First preference: an explicit tsconfig rootDir/outDir mapping. This also
  // handles custom output directories such as lib/ that are not part of the
  // conventional generated-directory list.
  if (outputRoot && (runtimePath === outputRoot || runtimePath.startsWith(outputRoot + '/'))) {
    const relative = runtimePath === outputRoot ? '' : runtimePath.slice(outputRoot.length + 1);
    if (relative) candidateStems.push(joinPosix(sourceRoot, stripExtension(relative)));
  }

  // Fallback for conventional compiler output when tsconfig is absent or
  // does not declare outDir.
  let conventionalSourceRoot: string | null = null;
  if (GENERATED_FILE_PATTERN.test(runtimePath)) {
    const segments = runtimePath.split('/');
    const generatedIndex = segments.findIndex((segment) => GENERATED_DIR_NAMES.has(segment));
    if (generatedIndex >= 0) {
      const relativeStem = stripExtension(segments.slice(generatedIndex + 1).join('/'));
      const generatedPrefix = segments.slice(0, generatedIndex).join('/');
      conventionalSourceRoot =
        entry.workspace === null ? joinPosix(generatedPrefix, 'src') : sourceRoot;
      if (relativeStem) candidateStems.push(joinPosix(conventionalSourceRoot, relativeStem));
    }
  }

  // Common CLI/library convention: package.json points at dist/<name>.js but
  // the editable entry surface is src/index.ts.
  candidateStems.push(joinPosix(sourceRoot, 'index'));
  if (conventionalSourceRoot && conventionalSourceRoot !== sourceRoot) {
    candidateStems.push(joinPosix(conventionalSourceRoot, 'index'));
  }

  for (const stem of [...new Set(candidateStems)]) {
    for (const candidate of sourceCandidatesForStem(stem)) {
      if (knownPaths.has(candidate)) return { ...entry, sourcePath: candidate };
    }
  }

  return entry;
}

function dedupeEntryPoints(entries: EntryPoint[]): EntryPoint[] {
  const byPath = new Map<string, EntryPoint>();
  const kindPriority: EntryPoint['kind'][] = [
    'bin',
    'main',
    'framework-convention',
    'script',
    'test-runner',
  ];

  for (const entry of entries) {
    const key = (entry.workspace ?? '') + ':' + toPosix(entry.path);
    const existing = byPath.get(key);
    if (!existing) {
      byPath.set(key, { ...entry, evidence: uniqueEvidence(entry.evidence) });
      continue;
    }

    const existingPriority = kindPriority.indexOf(existing.kind);
    const incomingPriority = kindPriority.indexOf(entry.kind);
    const kind =
      incomingPriority >= 0 && incomingPriority < existingPriority ? entry.kind : existing.kind;

    byPath.set(key, {
      ...existing,
      kind,
      sourcePath: existing.sourcePath ?? entry.sourcePath,
      evidence: uniqueEvidence([...existing.evidence, ...entry.evidence]),
    });
  }

  return [...byPath.values()];
}

/**
 * Maps generated/built bin/main entries back to editable source files using
 * tsconfig rootDir/outDir when available, then conventional src/ heuristics.
 * Runtime `path` is preserved; `sourcePath` is additive.
 *
 * Entries that share the same runtime path are collapsed into one record and
 * their evidence is merged. This prevents package.json declarations such as
 * two bin names plus main all pointing at dist/index.js from appearing as
 * three separate entry points.
 */
export async function resolveEntryPointSources(
  root: string,
  entryPoints: EntryPoint[],
  files: FileRecord[],
): Promise<EntryPoint[]> {
  const knownPaths = new Set(files.map((file) => toPosix(file.path)));
  const resolved = await Promise.all(
    entryPoints.map((entry) => resolveOneEntryPoint(root, entry, knownPaths)),
  );
  return dedupeEntryPoints(resolved);
}

import { dirname, join, normalize } from 'node:path';
import type { DependencyEdgeType, InternalDependencyEdge } from '@recall-ai/schemas';
import type { WalkedFile } from './file-walk.js';
import { readTextFileSafely } from './file-walk.js';
import { SOURCE_EXTENSIONS, TEST_FILE_PATTERN } from './constants.js';
import type { DiscoveredWorkspace } from './workspaces.js';

const IMPORT_PATTERN =
  /(?:import|export)\s+(?:[^'"]*?from\s+)?['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g;

const EXPORT_SYMBOL_PATTERN =
  /export\s+(?:default\s+)?(?:async\s+)?(?:function|class|interface|type|const|let|enum)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;

/** Bounded to keep a single very large generated-looking file from ballooning snapshot size. */
const MAX_EXPORTED_SYMBOLS_PER_FILE = 40;

const RESOLUTION_SUFFIXES = [
  '',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '/index.ts',
  '/index.tsx',
  '/index.js',
  '/index.jsx',
];

function toPosix(path: string): string {
  return path.split('\\').join('/');
}

/**
 * NodeNext-style ESM specifiers reference the *compiled* extension (e.g.
 * `./init.js`) even when they point at TypeScript source (`./init.ts`) —
 * this is the specifier style used throughout this codebase itself. Maps
 * each such extension to the source extension(s) that commonly compile to
 * it, tried in order.
 */
const COMPILED_TO_SOURCE_EXTENSIONS: Record<string, string[]> = {
  '.js': ['.ts', '.tsx'],
  '.jsx': ['.tsx'],
  '.mjs': ['.mts'],
  '.cjs': ['.cts'],
};

/**
 * Classifies which package.json dependency bucket a workspace-declared
 * dependency came from. `dependencies` wins if a name somehow appears in
 * more than one bucket (a runtime need takes priority for rendering/ranking
 * purposes over a redundant dev/peer/optional declaration of the same name).
 */
function workspaceDependencyType(
  workspace: DiscoveredWorkspace,
  dependencyName: string,
): DependencyEdgeType {
  if (workspace.packageJson.dependencies?.[dependencyName]) return 'runtime';
  if (workspace.packageJson.devDependencies?.[dependencyName]) return 'development';
  if (workspace.packageJson.peerDependencies?.[dependencyName]) return 'peer';
  if (workspace.packageJson.optionalDependencies?.[dependencyName]) return 'optional';
  return 'runtime';
}

function resolveRelativeImport(
  fromFile: string,
  specifier: string,
  knownFiles: Set<string>,
): string | null {
  const baseDir = dirname(fromFile);
  const target = toPosix(normalize(join(baseDir, specifier)));

  for (const suffix of RESOLUTION_SUFFIXES) {
    const candidate = `${target}${suffix}`;
    if (knownFiles.has(candidate)) return candidate;
  }

  // The specifier's own extension (if any) didn't match a known file
  // as-is — try mapping a compiled-style extension back to its source.
  for (const [compiledExt, sourceExts] of Object.entries(COMPILED_TO_SOURCE_EXTENSIONS)) {
    if (!target.endsWith(compiledExt)) continue;
    const base = target.slice(0, -compiledExt.length);
    for (const sourceExt of sourceExts) {
      const candidate = `${base}${sourceExt}`;
      if (knownFiles.has(candidate)) return candidate;
    }
  }

  return null;
}

export interface ImportGraphResult {
  edges: InternalDependencyEdge[];
  /**
   * Top-level exported symbol names per file path, collected in the same
   * read pass as import-graph parsing so task-focused ranking never needs
   * to re-read source files at context-generation time — the snapshot
   * already carries this evidence once a scan has run.
   */
  symbolsByPath: Map<string, string[]>;
}

/**
 * Builds internal dependency edges from two sources of evidence:
 * declared workspace dependencies (package.json), and static import/require
 * specifiers found in source files. Import parsing uses a regular expression
 * rather than a full AST parse (e.g. via ts-morph): specifiers are string
 * literals with a narrow grammar, so a regex is deterministic, fast across
 * thousands of files, and avoids the overhead of type-checking source that
 * Recall never executes. Exported top-level symbol names are collected in
 * the same pass, for the same reason.
 */
export async function buildImportGraph(
  root: string,
  files: WalkedFile[],
  workspaces: DiscoveredWorkspace[],
): Promise<ImportGraphResult> {
  const edges: InternalDependencyEdge[] = [];
  const symbolsByPath = new Map<string, string[]>();

  for (const workspace of workspaces) {
    for (const dependencyName of workspace.info.dependsOn) {
      const target = workspaces.find((w) => w.info.name === dependencyName);
      if (!target) continue;
      const dependencyType = workspaceDependencyType(workspace, dependencyName);
      edges.push({
        from: workspace.info.path,
        to: target.info.path,
        kind: 'workspace',
        dependencyType,
        evidence: [
          {
            path: join(workspace.info.path, 'package.json').split('\\').join('/'),
            reason: `declares a ${dependencyType} dependency on workspace package "${dependencyName}"`,
          },
        ],
      });
    }
  }

  const sourceFiles = files.filter((f) => SOURCE_EXTENSIONS.has(f.extension));
  const knownFiles = new Set(sourceFiles.map((f) => f.path));
  const nameToWorkspacePath = new Map(workspaces.map((w) => [w.info.name, w.info.path]));

  for (const file of sourceFiles) {
    const contents = await readTextFileSafely(join(root, file.path));
    if (contents === null) continue;

    // A test file's imports are only ever exercised at test time, never
    // shipped in the runtime; everything else counts as a runtime edge.
    const dependencyType: DependencyEdgeType = TEST_FILE_PATTERN.test(file.path)
      ? 'development'
      : 'runtime';

    const symbols: string[] = [];
    EXPORT_SYMBOL_PATTERN.lastIndex = 0;
    let symbolMatch: RegExpExecArray | null;
    while ((symbolMatch = EXPORT_SYMBOL_PATTERN.exec(contents)) !== null) {
      const name = symbolMatch[1];
      if (name && symbols.length < MAX_EXPORTED_SYMBOLS_PER_FILE) symbols.push(name);
    }
    if (symbols.length > 0) symbolsByPath.set(file.path, symbols);

    const lines = contents.split('\n');
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex] ?? '';
      IMPORT_PATTERN.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = IMPORT_PATTERN.exec(line)) !== null) {
        const specifier = match[1] ?? match[2];
        if (!specifier) continue;

        if (specifier.startsWith('.')) {
          const resolved = resolveRelativeImport(file.path, specifier, knownFiles);
          if (resolved && resolved !== file.path) {
            edges.push({
              from: file.path,
              to: resolved,
              kind: 'import',
              dependencyType,
              evidence: [
                { path: file.path, line: lineIndex + 1, reason: `imports "${specifier}"` },
              ],
            });
          }
        } else {
          const packageName = specifier.startsWith('@')
            ? specifier.split('/').slice(0, 2).join('/')
            : (specifier.split('/')[0] ?? specifier);
          const workspacePath = nameToWorkspacePath.get(packageName);
          if (workspacePath && workspacePath !== dirname(file.path)) {
            edges.push({
              from: file.path,
              to: workspacePath,
              kind: 'import',
              dependencyType,
              evidence: [
                {
                  path: file.path,
                  line: lineIndex + 1,
                  reason: `imports workspace package "${packageName}"`,
                },
              ],
            });
          }
        }
      }
    }
  }

  return { edges, symbolsByPath };
}

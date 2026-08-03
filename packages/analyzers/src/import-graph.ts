import { dirname, join, normalize } from 'node:path';
import type { InternalDependencyEdge } from '@recall-ai/schemas';
import type { WalkedFile } from './file-walk.js';
import { readTextFileSafely } from './file-walk.js';
import { SOURCE_EXTENSIONS } from './constants.js';
import type { DiscoveredWorkspace } from './workspaces.js';

const IMPORT_PATTERN =
  /(?:import|export)\s+(?:[^'"]*?from\s+)?['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g;

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
  return null;
}

/**
 * Builds internal dependency edges from two sources of evidence:
 * declared workspace dependencies (package.json), and static import/require
 * specifiers found in source files. Import parsing uses a regular expression
 * rather than a full AST parse (e.g. via ts-morph): specifiers are string
 * literals with a narrow grammar, so a regex is deterministic, fast across
 * thousands of files, and avoids the overhead of type-checking source that
 * Recall never executes.
 */
export async function buildImportGraph(
  root: string,
  files: WalkedFile[],
  workspaces: DiscoveredWorkspace[],
): Promise<InternalDependencyEdge[]> {
  const edges: InternalDependencyEdge[] = [];

  for (const workspace of workspaces) {
    for (const dependencyName of workspace.info.dependsOn) {
      const target = workspaces.find((w) => w.info.name === dependencyName);
      if (!target) continue;
      edges.push({
        from: workspace.info.path,
        to: target.info.path,
        kind: 'workspace',
        evidence: [
          {
            path: join(workspace.info.path, 'package.json').split('\\').join('/'),
            reason: `declares dependency on workspace package "${dependencyName}"`,
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

  return edges;
}

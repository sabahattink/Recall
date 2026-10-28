import { join } from 'node:path';
import type { Fact } from '@recall-ai/schemas';
import type { WalkedFile } from './file-walk.js';
import { readJsonIfExists } from './json.js';

interface PackageJsonShape {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

type DependencyScope = 'dependency' | 'devDependency' | 'peerDependency';

/** Manifest field to Fact scope, in fixed extraction order — never Object.keys() order. */
const SCOPE_FIELDS: Array<{ field: keyof PackageJsonShape; scope: DependencyScope }> = [
  { field: 'dependencies', scope: 'dependency' },
  { field: 'devDependencies', scope: 'devDependency' },
  { field: 'peerDependencies', scope: 'peerDependency' },
];

function basename(path: string): string {
  const segments = path.split('/');
  return segments[segments.length - 1] ?? path;
}

/**
 * Extracts direct dependency declarations from every `package.json` a
 * prior `walkRepository` call already found, as one Fact per declared
 * dependency. Each `package.json` `files` already confirmed exists is read
 * once; no directory is walked again — the same pattern already used by
 * framework and command/tooling detection (SCAN-04, SCAN-06).
 *
 * Only entries appearing directly in a `package.json`'s `dependencies`,
 * `devDependencies`, or `peerDependencies` are extracted. No lockfile is
 * ever read here: a lockfile resolves the full transitive tree, and this
 * task's evidence must be a direct manifest declaration, never a
 * transitively-resolved package (docs/implementation-blueprint.md SCAN-07).
 * A repository with only a lockfile and no `package.json` in `files`
 * produces no dependency Facts at all.
 *
 * `optionalDependencies` is intentionally out of scope: no existing schema
 * or detector in this codebase (including the pre-existing
 * `DependencyScopeSchema`) models it as a distinct dependency scope, and
 * adding a fourth scope with no established precedent would be a new
 * invention rather than a reuse of existing domain knowledge.
 */
export async function detectDependencyFacts(files: WalkedFile[], root: string): Promise<Fact[]> {
  const packageJsonFiles = files
    .filter((f) => basename(f.path) === 'package.json')
    .sort((a, b) => a.path.localeCompare(b.path));

  const facts: Fact[] = [];

  for (const pkgFile of packageJsonFiles) {
    const content = await readJsonIfExists<PackageJsonShape>(join(root, pkgFile.path));
    if (!content) continue;

    for (const { field, scope } of SCOPE_FIELDS) {
      const declarations = content[field];
      if (!declarations) continue;

      for (const name of Object.keys(declarations).sort()) {
        facts.push({
          category: 'dependency',
          value: { name, version: declarations[name], scope },
          evidence: [{ path: pkgFile.path, reason: `${field}.${name} declared` }],
        });
      }
    }
  }

  return facts;
}

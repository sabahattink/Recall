import { join } from 'node:path';
import { redactSecrets, type DependencyScope, type FactOf } from '@recall-ai/schemas';
import type { WalkedFile } from './file-walk.js';
import { readJsonIfExists } from './json.js';
import { compareStrings } from '@recall-ai/schemas';
import { basename } from './path-utils.js';

interface PackageJsonShape {
  dependencies?: unknown;
  devDependencies?: unknown;
  peerDependencies?: unknown;
}

/** Manifest field to Fact scope, in fixed extraction order — never Object.keys() order. */
const SCOPE_FIELDS: Array<{ field: keyof PackageJsonShape; scope: DependencyScope }> = [
  { field: 'dependencies', scope: 'dependency' },
  { field: 'devDependencies', scope: 'devDependency' },
  { field: 'peerDependencies', scope: 'peerDependency' },
];

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
 * `optionalDependencies` is intentionally out of scope: `DependencyScopeSchema`
 * models exactly the three scopes above. A declaration whose version is not
 * a string is malformed and skipped, never reported with a made-up version.
 * Versions are passed through `redactSecrets`: a specifier such as
 * `git+https://user:token@host/repo.git` must not carry its token into
 * `memory.json`.
 */
export async function detectDependencyFacts(
  files: WalkedFile[],
  root: string,
): Promise<FactOf<'dependency'>[]> {
  const packageJsonFiles = files
    .filter((f) => basename(f.path) === 'package.json')
    .sort((a, b) => compareStrings(a.path, b.path));

  const facts: FactOf<'dependency'>[] = [];

  for (const pkgFile of packageJsonFiles) {
    const content = await readJsonIfExists<PackageJsonShape>(join(root, pkgFile.path));
    if (!content) continue;

    for (const { field, scope } of SCOPE_FIELDS) {
      const declarations = content[field];
      if (typeof declarations !== 'object' || declarations === null) continue;
      if (Array.isArray(declarations)) continue;

      const entries = Object.entries(declarations)
        .filter(
          (entry): entry is [string, string] => entry[0] !== '' && typeof entry[1] === 'string',
        )
        .sort(([a], [b]) => compareStrings(a, b));
      for (const [name, version] of entries) {
        facts.push({
          category: 'dependency',
          value: { name, version: redactSecrets(version), scope },
          evidence: [{ path: pkgFile.path, reason: `${field}.${name} declared` }],
        });
      }
    }
  }

  return facts;
}

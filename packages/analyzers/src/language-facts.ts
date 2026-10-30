import type { FactOf } from '@recall-ai/schemas';
import type { WalkedFile } from './file-walk.js';

interface LanguageRule {
  /** The Fact `value` emitted when this rule matches. */
  name: string;
  /** Root-relative paths whose mere presence is strong, direct evidence. */
  manifestPaths: string[];
  /** File extensions used as evidence only when no manifest path is present. */
  extensions: string[];
}

/**
 * Order is the emission order for `detectLanguageFacts`, fixed and
 * hand-written (never derived from Set/Map iteration) so output is
 * deterministic regardless of input file order.
 */
const LANGUAGE_RULES: LanguageRule[] = [
  {
    name: 'TypeScript',
    manifestPaths: ['tsconfig.json'],
    extensions: ['.ts', '.tsx', '.mts', '.cts'],
  },
  { name: 'JavaScript', manifestPaths: [], extensions: ['.js', '.jsx', '.mjs', '.cjs'] },
  {
    name: 'Python',
    manifestPaths: ['requirements.txt', 'pyproject.toml', 'Pipfile'],
    extensions: ['.py'],
  },
  { name: 'Go', manifestPaths: ['go.mod'], extensions: ['.go'] },
  { name: 'Rust', manifestPaths: ['Cargo.toml'], extensions: ['.rs'] },
];

interface PackageManagerRule {
  name: string;
  /** Root-relative lockfile, manifest, or workspace file whose presence is the evidence. */
  evidencePath: string;
}

/** Order is the emission order for `detectPackageManagerFacts`, fixed for the same reason as LANGUAGE_RULES. */
const PACKAGE_MANAGER_RULES: PackageManagerRule[] = [
  { name: 'pnpm', evidencePath: 'pnpm-lock.yaml' },
  { name: 'pnpm', evidencePath: 'pnpm-workspace.yaml' },
  { name: 'npm', evidencePath: 'package-lock.json' },
  { name: 'yarn', evidencePath: 'yarn.lock' },
  { name: 'bun', evidencePath: 'bun.lock' },
  { name: 'bun', evidencePath: 'bun.lockb' },
  { name: 'pip', evidencePath: 'requirements.txt' },
  { name: 'poetry', evidencePath: 'poetry.lock' },
  { name: 'uv', evidencePath: 'uv.lock' },
  { name: 'pipenv', evidencePath: 'Pipfile.lock' },
  { name: 'go-modules', evidencePath: 'go.mod' },
  { name: 'cargo', evidencePath: 'Cargo.toml' },
];

/**
 * Detects languages present in a repository, from the file list a prior
 * `walkRepository` call already produced (no filesystem access of its own,
 * per SCAN-02: this consumes "the file list every other detector reads
 * from" rather than walking the tree again).
 *
 * A manifest path (e.g. `tsconfig.json`) is preferred evidence when
 * present; a matching source file is used only as a fallback so every
 * emitted Fact still cites real evidence. A language with neither present
 * produces no Fact — absence of evidence is absence of a claim, never a
 * guess (docs/product-specification.md §15).
 */
export function detectLanguageFacts(files: WalkedFile[]): FactOf<'language'>[] {
  const filePaths = new Set(files.map((f) => f.path));
  const facts: FactOf<'language'>[] = [];

  for (const rule of LANGUAGE_RULES) {
    const manifestPath = rule.manifestPaths.find((path) => filePaths.has(path));
    if (manifestPath) {
      facts.push({
        category: 'language',
        value: rule.name,
        evidence: [{ path: manifestPath, reason: `${manifestPath} present` }],
      });
      continue;
    }

    const sourceFile = files.find((f) => rule.extensions.includes(f.extension));
    if (sourceFile) {
      facts.push({
        category: 'language',
        value: rule.name,
        evidence: [
          { path: sourceFile.path, reason: `${sourceFile.extension} source file present` },
        ],
      });
    }
  }

  return facts;
}

/**
 * Detects package managers in use, from the same walked file list as
 * `detectLanguageFacts`. `pyproject.toml` alone is deliberately not evidence
 * of any package manager: setuptools, Poetry, uv, Hatch, and PDM all read
 * it, so only a manager-specific lockfile is. Detection is presence-only (does not parse
 * `package.json`'s `packageManager` field or any manifest content) —
 * lockfile presence alone is sufficient, directly citable evidence for
 * every ecosystem this task covers.
 */
export function detectPackageManagerFacts(files: WalkedFile[]): FactOf<'package-manager'>[] {
  const filePaths = new Set(files.map((f) => f.path));
  const facts: FactOf<'package-manager'>[] = [];

  const emitted = new Set<string>();

  for (const rule of PACKAGE_MANAGER_RULES) {
    // A manager with several evidence files (Bun's two lockfile formats,
    // pnpm's lockfile and workspace file) is reported once, citing the first.
    if (emitted.has(rule.name)) continue;
    if (filePaths.has(rule.evidencePath)) {
      emitted.add(rule.name);
      facts.push({
        category: 'package-manager',
        value: rule.name,
        evidence: [{ path: rule.evidencePath, reason: `${rule.evidencePath} present` }],
      });
    }
  }

  return facts;
}

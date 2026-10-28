import type { Fact } from '@recall-ai/schemas';
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
  /** Root-relative lockfile/manifest path whose presence is the evidence. */
  lockfilePath: string;
}

/** Order is the emission order for `detectPackageManagerFacts`, fixed for the same reason as LANGUAGE_RULES. */
const PACKAGE_MANAGER_RULES: PackageManagerRule[] = [
  { name: 'pnpm', lockfilePath: 'pnpm-lock.yaml' },
  { name: 'npm', lockfilePath: 'package-lock.json' },
  { name: 'yarn', lockfilePath: 'yarn.lock' },
  { name: 'pip', lockfilePath: 'requirements.txt' },
  { name: 'poetry', lockfilePath: 'pyproject.toml' },
  { name: 'go-modules', lockfilePath: 'go.mod' },
  { name: 'cargo', lockfilePath: 'Cargo.toml' },
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
export function detectLanguageFacts(files: WalkedFile[]): Fact[] {
  const filePaths = new Set(files.map((f) => f.path));
  const facts: Fact[] = [];

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
 * `detectLanguageFacts`. Detection is presence-only (does not parse
 * `package.json`'s `packageManager` field or any manifest content) —
 * lockfile presence alone is sufficient, directly citable evidence for
 * every ecosystem this task covers.
 */
export function detectPackageManagerFacts(files: WalkedFile[]): Fact[] {
  const filePaths = new Set(files.map((f) => f.path));
  const facts: Fact[] = [];

  for (const rule of PACKAGE_MANAGER_RULES) {
    if (filePaths.has(rule.lockfilePath)) {
      facts.push({
        category: 'package-manager',
        value: rule.name,
        evidence: [{ path: rule.lockfilePath, reason: `${rule.lockfilePath} present` }],
      });
    }
  }

  return facts;
}

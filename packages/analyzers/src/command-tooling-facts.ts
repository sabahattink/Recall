import { join } from 'node:path';
import type { Fact } from '@recall-ai/schemas';
import type { WalkedFile } from './file-walk.js';
import { readJsonIfExists } from './json.js';
import { TEST_FRAMEWORK_DEPENDENCIES } from './testing.js';

interface PackageJsonShape {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/** Canonical command roles this task detects, in the order named by docs/implementation-blueprint.md SCAN-06. */
const CANONICAL_COMMANDS = ['install', 'build', 'test', 'lint', 'dev'];

/**
 * ESLint config file basenames, matched at any depth. Kept in sync by hand
 * with `conventions.ts`'s equivalent (private, unexported) candidate list —
 * that list lives inside a function coupled to the old
 * `DiscoveredWorkspace[]`-based pipeline and cannot be imported without
 * restructuring still-in-use code, so the values are reused here by
 * content rather than by reference.
 */
const ESLINT_CONFIG_FILE_NAMES = [
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.ts',
  '.eslintrc.json',
  '.eslintrc.js',
  '.eslintrc',
];

function basename(path: string): string {
  const segments = path.split('/');
  return segments[segments.length - 1] ?? path;
}

/**
 * Detects install/build/test/lint/dev commands, testing framework, and
 * linting configuration — all from a single targeted read of the root
 * `package.json` (a file `files` must already confirm exists) plus a
 * presence check against `files` for ESLint config files. No filesystem
 * access beyond that one read; no directory is walked again.
 *
 * Command detection is scoped to the root `package.json` only —
 * per-workspace command enumeration across a monorepo is not attempted
 * (see the accompanying task report). Testing-framework detection prefers
 * exact manifest evidence (a dependency declaration) over a config-file
 * heuristic, per this task's instructions; linting detection accepts
 * either, matching the acceptance criteria's own "dependency or config
 * file" wording and the precedent already set by framework detection
 * (SCAN-04).
 *
 * A malformed or absent root `package.json` produces no command or
 * testing-framework Facts — absence of evidence is absence of a claim,
 * never fabricated output (docs/product-specification.md §15). Linting can
 * still be detected from a config file alone in that case.
 */
export async function detectCommandAndToolingFacts(
  files: WalkedFile[],
  root: string,
): Promise<Fact[]> {
  const rootPackageJsonFile = files.find((f) => f.path === 'package.json');
  const packageJson = rootPackageJsonFile
    ? await readJsonIfExists<PackageJsonShape>(join(root, rootPackageJsonFile.path))
    : null;

  return [
    ...detectCommandFacts(packageJson),
    ...detectTestingFrameworkFacts(packageJson),
    ...detectLintingFacts(files, packageJson),
  ];
}

function detectCommandFacts(packageJson: PackageJsonShape | null): Fact[] {
  const scripts = packageJson?.scripts ?? {};
  const facts: Fact[] = [];

  for (const name of CANONICAL_COMMANDS) {
    const command = scripts[name];
    if (command) {
      facts.push({
        category: 'command',
        value: { name, command },
        evidence: [{ path: 'package.json', reason: `scripts.${name} declared as "${command}"` }],
      });
    }
  }

  return facts;
}

function detectTestingFrameworkFacts(packageJson: PackageJsonShape | null): Fact[] {
  const allDependencies = { ...packageJson?.dependencies, ...packageJson?.devDependencies };
  const facts: Fact[] = [];

  for (const name of TEST_FRAMEWORK_DEPENDENCIES) {
    if (allDependencies[name]) {
      facts.push({
        category: 'testing-framework',
        value: name,
        evidence: [{ path: 'package.json', reason: `dependency "${name}" declared` }],
      });
    }
  }

  return facts;
}

function detectLintingFacts(files: WalkedFile[], packageJson: PackageJsonShape | null): Fact[] {
  const evidence: Fact['evidence'] = [];

  const hasEslintDependency = Boolean(
    packageJson?.dependencies?.eslint || packageJson?.devDependencies?.eslint,
  );
  if (hasEslintDependency) {
    evidence.push({ path: 'package.json', reason: 'dependency "eslint" declared' });
  }

  const configFile = files.find((f) => ESLINT_CONFIG_FILE_NAMES.includes(basename(f.path)));
  if (configFile) {
    evidence.push({ path: configFile.path, reason: `${basename(configFile.path)} present` });
  }

  if (evidence.length === 0) return [];
  return [{ category: 'linting', value: 'eslint', evidence }];
}

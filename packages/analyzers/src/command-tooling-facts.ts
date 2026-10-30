import { join } from 'node:path';
import { redactSecrets, type FactOf } from '@recall-ai/schemas';
import type { WalkedFile } from './file-walk.js';
import { readJsonIfExists } from './json.js';
import { basename } from './path-utils.js';

interface PackageJsonShape {
  scripts?: unknown;
  dependencies?: unknown;
  devDependencies?: unknown;
}

/**
 * Script names this detector reports, in emission order: the five roles
 * named by docs/implementation-blueprint.md SCAN-06 first, then the other
 * lifecycle scripts an assistant needs to run or verify a change. Any other
 * script is a project-specific detail, not a command every assistant needs.
 */
const CANONICAL_COMMANDS = [
  'install',
  'build',
  'test',
  'lint',
  'dev',
  'start',
  'typecheck',
  'format',
];

/** Test-runner package names, in emission order. */
export const TEST_FRAMEWORK_DEPENDENCIES = [
  'vitest',
  'jest',
  'mocha',
  'ava',
  'jasmine',
  '@playwright/test',
  'cypress',
];

interface LintingToolRule {
  /** The Fact `value` emitted when this rule matches. */
  name: string;
  /** Exact package names whose declaration is evidence of the tool. */
  dependencyNames: string[];
  /** Config file basenames, matched at any depth, whose presence is evidence of the tool. */
  configFileNames: string[];
}

/** Lint/format tooling, in emission order. */
const LINTING_TOOL_RULES: LintingToolRule[] = [
  {
    name: 'eslint',
    dependencyNames: ['eslint'],
    configFileNames: [
      'eslint.config.js',
      'eslint.config.mjs',
      'eslint.config.cjs',
      'eslint.config.ts',
      '.eslintrc.json',
      '.eslintrc.js',
      '.eslintrc.cjs',
      '.eslintrc.yml',
      '.eslintrc.yaml',
      '.eslintrc',
    ],
  },
  {
    name: 'prettier',
    dependencyNames: ['prettier'],
    configFileNames: [
      '.prettierrc',
      '.prettierrc.json',
      '.prettierrc.js',
      '.prettierrc.cjs',
      '.prettierrc.mjs',
      '.prettierrc.yml',
      '.prettierrc.yaml',
      'prettier.config.js',
      'prettier.config.cjs',
      'prettier.config.mjs',
    ],
  },
  {
    name: 'biome',
    dependencyNames: ['@biomejs/biome'],
    configFileNames: ['biome.json', 'biome.jsonc'],
  },
];

function stringRecord(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

/**
 * Detects lifecycle commands, testing framework, and lint/format tooling —
 * all from a single targeted read of the root `package.json` (a file
 * `files` must already confirm exists) plus a presence check against
 * `files` for tool config files. No directory is walked again.
 *
 * Command detection is scoped to the root `package.json` only —
 * per-workspace command enumeration across a monorepo is not attempted.
 * Testing-framework detection requires a dependency declaration; lint/format
 * tooling accepts either a dependency or a config file, matching
 * docs/implementation-blueprint.md SCAN-06's "dependency or config file".
 *
 * A malformed or absent root `package.json` produces no command or
 * testing-framework Facts, and a manifest entry with a non-string value is
 * skipped — absence of evidence is absence of a claim, never fabricated
 * output (docs/product-specification.md §15). Tooling can still be detected
 * from a config file alone in that case.
 */
export async function detectCommandAndToolingFacts(
  files: WalkedFile[],
  root: string,
): Promise<Array<FactOf<'command'> | FactOf<'testing-framework'> | FactOf<'linting'>>> {
  const rootPackageJsonFile = files.find((f) => f.path === 'package.json');
  const packageJson = rootPackageJsonFile
    ? await readJsonIfExists<PackageJsonShape>(join(root, rootPackageJsonFile.path))
    : null;

  const declaredDependencies = new Set([
    ...Object.keys(stringRecord(packageJson?.dependencies)),
    ...Object.keys(stringRecord(packageJson?.devDependencies)),
  ]);

  return [
    ...detectCommandFacts(stringRecord(packageJson?.scripts)),
    ...detectTestingFrameworkFacts(declaredDependencies),
    ...detectLintingFacts(files, declaredDependencies),
  ];
}

function detectCommandFacts(scripts: Record<string, string>): FactOf<'command'>[] {
  const facts: FactOf<'command'>[] = [];

  for (const name of CANONICAL_COMMANDS) {
    const declared = scripts[name];
    if (declared) {
      // A script body can carry credentials (`API_KEY=… node x`); it is
      // recorded only after secrets are scrubbed.
      const command = redactSecrets(declared);
      facts.push({
        category: 'command',
        value: { name, command },
        evidence: [{ path: 'package.json', reason: `scripts.${name} declared as "${command}"` }],
      });
    }
  }

  return facts;
}

function detectTestingFrameworkFacts(
  declaredDependencies: Set<string>,
): FactOf<'testing-framework'>[] {
  return TEST_FRAMEWORK_DEPENDENCIES.filter((name) => declaredDependencies.has(name)).map(
    (name) => ({
      category: 'testing-framework',
      value: name,
      evidence: [{ path: 'package.json', reason: `dependency "${name}" declared` }],
    }),
  );
}

function detectLintingFacts(
  files: WalkedFile[],
  declaredDependencies: Set<string>,
): FactOf<'linting'>[] {
  const facts: FactOf<'linting'>[] = [];

  for (const rule of LINTING_TOOL_RULES) {
    const evidence: FactOf<'linting'>['evidence'] = [];

    const dependencyName = rule.dependencyNames.find((name) => declaredDependencies.has(name));
    if (dependencyName) {
      evidence.push({ path: 'package.json', reason: `dependency "${dependencyName}" declared` });
    }

    const configFile = files.find((f) => rule.configFileNames.includes(basename(f.path)));
    if (configFile) {
      evidence.push({ path: configFile.path, reason: `${basename(configFile.path)} present` });
    }

    if (evidence.length > 0) facts.push({ category: 'linting', value: rule.name, evidence });
  }

  return facts;
}

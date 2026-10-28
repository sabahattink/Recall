import { join } from 'node:path';
import type { Fact } from '@recall-ai/schemas';
import type { WalkedFile } from './file-walk.js';
import { readJsonIfExists } from './json.js';

interface FrameworkConfigRule {
  /** The Fact `value` emitted when this rule matches. */
  name: string;
  /** Config file basenames that are unambiguous evidence of this framework, matched at any depth. */
  configFileNames: string[];
}

/**
 * Config-file signals: each entry here has no common non-framework use, so
 * presence alone is zero-false-positive evidence.
 */
const FRAMEWORK_CONFIG_RULES: FrameworkConfigRule[] = [
  { name: 'nestjs', configFileNames: ['nest-cli.json'] },
  { name: 'nextjs', configFileNames: ['next.config.js', 'next.config.mjs', 'next.config.ts'] },
];

interface FrameworkDependencyRule {
  name: string;
  /** The exact package name in `dependencies`/`devDependencies` that is evidence for this framework. */
  dependencyName: string;
}

/**
 * Dependency-declaration signals, matched against `package.json`'s
 * `dependencies`/`devDependencies`. Each package name here is specific to
 * exactly one framework — no generic or ambiguous names.
 */
const FRAMEWORK_DEPENDENCY_RULES: FrameworkDependencyRule[] = [
  { name: 'nestjs', dependencyName: '@nestjs/core' },
  { name: 'nextjs', dependencyName: 'next' },
  { name: 'react', dependencyName: 'react' },
  { name: 'express', dependencyName: 'express' },
  { name: 'fastify', dependencyName: 'fastify' },
  { name: 'vue', dependencyName: 'vue' },
];

/** Fixed emission order for the merged result — never Map/Set iteration order. */
const EMISSION_ORDER = FRAMEWORK_CONFIG_RULES.map((r) => r.name).concat(
  FRAMEWORK_DEPENDENCY_RULES.map((r) => r.name).filter(
    (name) => !FRAMEWORK_CONFIG_RULES.some((r) => r.name === name),
  ),
);

interface PackageJsonShape {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function basename(path: string): string {
  const segments = path.split('/');
  return segments[segments.length - 1] ?? path;
}

/**
 * Detects application frameworks from the file list a prior
 * `walkRepository` call already produced, using two evidence sources:
 *
 * 1. Characteristic config files (e.g. `next.config.ts`) — detected purely
 *    from `files`, no filesystem access.
 * 2. Dependency declarations (e.g. `react` in `package.json`) — for every
 *    `package.json` `files` already confirmed exists, its content is read
 *    once via `readJsonIfExists`. This is not a second traversal: `files`
 *    remains the sole source of truth for which paths are read, and no
 *    directory is walked again. Reading the content of an already-known
 *    file is the same category of operation the Blueprint's later Scanner
 *    tasks (dependency and command extraction) already require.
 *
 * Every `package.json` found is processed in sorted-path order, so output
 * is deterministic regardless of `files`' input order. When both a config
 * file and a dependency point to the same framework, their evidence is
 * merged into a single Fact rather than emitted twice. Next.js implies
 * React as a direct dependency, so a standalone React Fact is suppressed
 * once Next.js is already confirmed — otherwise every Next.js repository
 * would also report a redundant, lower-value React Fact.
 *
 * A framework with no matching config file or dependency produces no Fact
 * — absence of evidence is absence of a claim, never a guess
 * (docs/product-specification.md §15).
 */
export async function detectFrameworkFacts(files: WalkedFile[], root: string): Promise<Fact[]> {
  const evidenceByFramework = new Map<string, Fact['evidence']>();

  function addEvidence(name: string, entry: Fact['evidence'][number]): void {
    const existing = evidenceByFramework.get(name);
    if (existing) existing.push(entry);
    else evidenceByFramework.set(name, [entry]);
  }

  for (const rule of FRAMEWORK_CONFIG_RULES) {
    const match = files.find((f) => rule.configFileNames.includes(basename(f.path)));
    if (match) {
      addEvidence(rule.name, { path: match.path, reason: `${basename(match.path)} present` });
    }
  }

  const packageJsonFiles = files
    .filter((f) => basename(f.path) === 'package.json')
    .sort((a, b) => a.path.localeCompare(b.path));

  for (const pkgFile of packageJsonFiles) {
    const content = await readJsonIfExists<PackageJsonShape>(join(root, pkgFile.path));
    if (!content) continue;

    const allDependencies = { ...content.dependencies, ...content.devDependencies };
    for (const rule of FRAMEWORK_DEPENDENCY_RULES) {
      if (allDependencies[rule.dependencyName]) {
        addEvidence(rule.name, {
          path: pkgFile.path,
          reason: `dependency "${rule.dependencyName}" declared`,
        });
      }
    }
  }

  if (evidenceByFramework.has('nextjs')) {
    evidenceByFramework.delete('react');
  }

  const facts: Fact[] = [];
  for (const name of EMISSION_ORDER) {
    const evidence = evidenceByFramework.get(name);
    if (evidence) facts.push({ category: 'framework', value: name, evidence });
  }
  return facts;
}

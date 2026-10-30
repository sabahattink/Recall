import { join } from 'node:path';
import type { Evidence, FactOf } from '@recall-ai/schemas';
import type { WalkedFile } from './file-walk.js';
import { readJsonIfExists } from './json.js';
import { compareStrings } from '@recall-ai/schemas';
import { basename } from './path-utils.js';

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
  { name: 'angular', configFileNames: ['angular.json'] },
  { name: 'nuxt', configFileNames: ['nuxt.config.ts', 'nuxt.config.js', 'nuxt.config.mjs'] },
  { name: 'svelte', configFileNames: ['svelte.config.js', 'svelte.config.mjs'] },
  { name: 'astro', configFileNames: ['astro.config.mjs', 'astro.config.ts', 'astro.config.js'] },
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
  { name: 'angular', dependencyName: '@angular/core' },
  { name: 'nuxt', dependencyName: 'nuxt' },
  { name: 'sveltekit', dependencyName: '@sveltejs/kit' },
  { name: 'svelte', dependencyName: 'svelte' },
  { name: 'astro', dependencyName: 'astro' },
  { name: 'remix', dependencyName: '@remix-run/react' },
  { name: 'react-native', dependencyName: 'react-native' },
  { name: 'electron', dependencyName: 'electron' },
  { name: 'hono', dependencyName: 'hono' },
  { name: 'koa', dependencyName: 'koa' },
];

/**
 * A meta-framework always declares its underlying UI library as a direct
 * dependency, so once the meta-framework is confirmed the library's own
 * Fact adds nothing and is suppressed (key suppresses each value).
 */
const IMPLIED_FRAMEWORKS: Record<string, string[]> = {
  nextjs: ['react'],
  remix: ['react'],
  'react-native': ['react'],
  nuxt: ['vue'],
  sveltekit: ['svelte'],
};

/** Fixed emission order for the merged result — never Map/Set iteration order. */
const EMISSION_ORDER = FRAMEWORK_CONFIG_RULES.map((r) => r.name).concat(
  FRAMEWORK_DEPENDENCY_RULES.map((r) => r.name).filter(
    (name) => !FRAMEWORK_CONFIG_RULES.some((r) => r.name === name),
  ),
);

interface PackageJsonShape {
  dependencies?: unknown;
  devDependencies?: unknown;
}

function declaredNames(field: unknown): string[] {
  return typeof field === 'object' && field !== null && !Array.isArray(field)
    ? Object.keys(field)
    : [];
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
 * merged into a single Fact rather than emitted twice. A meta-framework
 * suppresses the UI library it is built on (see IMPLIED_FRAMEWORKS) —
 * otherwise every Next.js repository would also report a redundant,
 * lower-value React Fact.
 *
 * A framework with no matching config file or dependency produces no Fact
 * — absence of evidence is absence of a claim, never a guess
 * (docs/product-specification.md §15).
 */
export async function detectFrameworkFacts(
  files: WalkedFile[],
  root: string,
): Promise<FactOf<'framework'>[]> {
  const evidenceByFramework = new Map<string, Evidence[]>();

  function addEvidence(name: string, entry: Evidence): void {
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
    .sort((a, b) => compareStrings(a.path, b.path));

  for (const pkgFile of packageJsonFiles) {
    const content = await readJsonIfExists<PackageJsonShape>(join(root, pkgFile.path));
    if (!content) continue;

    const allDependencies = new Set([
      ...declaredNames(content.dependencies),
      ...declaredNames(content.devDependencies),
    ]);
    for (const rule of FRAMEWORK_DEPENDENCY_RULES) {
      if (allDependencies.has(rule.dependencyName)) {
        addEvidence(rule.name, {
          path: pkgFile.path,
          reason: `dependency "${rule.dependencyName}" declared`,
        });
      }
    }
  }

  for (const [framework, implied] of Object.entries(IMPLIED_FRAMEWORKS)) {
    if (!evidenceByFramework.has(framework)) continue;
    for (const name of implied) evidenceByFramework.delete(name);
  }

  const facts: FactOf<'framework'>[] = [];
  for (const name of EMISSION_ORDER) {
    const evidence = evidenceByFramework.get(name);
    if (evidence) facts.push({ category: 'framework', value: name, evidence });
  }
  return facts;
}

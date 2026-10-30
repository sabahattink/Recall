import type { Dependency, Evidence, NamedEntry, ProjectMemory } from '@recall-ai/schemas';
import { code, text } from './markdown.js';

/**
 * Section bodies shared by the agent templates. Each function is a pure
 * view over Project Memory returning Markdown lines, or `[]` when memory
 * holds nothing for that section (the template then omits the heading).
 * Templates differ in which sections they include, in what order, and under
 * which headings — never in what is true about the repository.
 */

/** Human-readable names for the identifiers the Scanner emits. Unlisted identifiers render as-is. */
const DISPLAY_NAMES: Record<string, string> = {
  nextjs: 'Next.js',
  nestjs: 'NestJS',
  react: 'React',
  express: 'Express',
  fastify: 'Fastify',
  vue: 'Vue',
  angular: 'Angular',
  nuxt: 'Nuxt',
  sveltekit: 'SvelteKit',
  svelte: 'Svelte',
  astro: 'Astro',
  remix: 'Remix',
  'react-native': 'React Native',
  electron: 'Electron',
  hono: 'Hono',
  koa: 'Koa',
  pnpm: 'pnpm',
  npm: 'npm',
  yarn: 'Yarn',
  bun: 'Bun',
  pip: 'pip',
  poetry: 'Poetry',
  uv: 'uv',
  pipenv: 'Pipenv',
  'go-modules': 'Go modules',
  cargo: 'Cargo',
  vitest: 'Vitest',
  jest: 'Jest',
  mocha: 'Mocha',
  ava: 'AVA',
  jasmine: 'Jasmine',
  '@playwright/test': 'Playwright',
  cypress: 'Cypress',
  eslint: 'ESLint',
  prettier: 'Prettier',
  biome: 'Biome',
};

export function displayName(name: string): string {
  return DISPLAY_NAMES[name] ?? text(name);
}

/** How a package manager installs a project's declared dependencies. */
const INSTALL_COMMANDS: Record<string, string> = {
  pnpm: 'pnpm install',
  npm: 'npm install',
  yarn: 'yarn install',
  bun: 'bun install',
  pip: 'pip install -r requirements.txt',
  poetry: 'poetry install',
  uv: 'uv sync',
  pipenv: 'pipenv install',
  'go-modules': 'go mod download',
  cargo: 'cargo fetch',
};

/**
 * Package managers grouped by the ecosystem whose dependencies they
 * install. Within one group, two detected managers (say, both a
 * `pnpm-lock.yaml` and a `package-lock.json`) make the install command
 * ambiguous, so none is suggested for that group.
 */
const ECOSYSTEMS: string[][] = [
  ['pnpm', 'npm', 'yarn', 'bun'],
  ['pip', 'poetry', 'uv', 'pipenv'],
  ['go-modules'],
  ['cargo'],
];

const JAVASCRIPT_MANAGERS = ECOSYSTEMS[0] ?? [];

export interface CitationOptions {
  /** Append the evidence paths behind each claim, e.g. "Vitest (`package.json`)". */
  cite: boolean;
}

/** The project's declared name, or a neutral phrase when no manifest declares one. */
export function projectTitle(memory: ProjectMemory): string {
  return memory.metadata.name ? text(memory.metadata.name.value) : 'This repository';
}

/** Distinct evidence paths as code spans; falls back to the evidence reasons for root-level (`.`) evidence. */
export function evidenceSummary(evidence: Evidence[]): string {
  const paths = [...new Set(evidence.map((e) => e.path).filter((path) => path !== '.'))];
  if (paths.length > 0) return paths.map(code).join(', ');
  return [...new Set(evidence.map((e) => e.reason))].map(text).join('; ');
}

function namedList(entries: NamedEntry[], { cite }: CitationOptions): string {
  return entries
    .map((entry) => {
      const name = displayName(entry.name);
      return cite ? `${name} (${evidenceSummary(entry.evidence)})` : name;
    })
    .join(', ');
}

/** The project description as its own paragraph (followed by a blank line). */
export function descriptionLines(memory: ProjectMemory): string[] {
  return memory.metadata.description ? [text(memory.metadata.description.value), ''] : [];
}

export function stackLines(memory: ProjectMemory, options: CitationOptions): string[] {
  const { languages, frameworks, packageManagers } = memory.stack;
  const lines: string[] = [];
  if (languages.length > 0) lines.push(`- Languages: ${namedList(languages, options)}`);
  if (frameworks.length > 0) lines.push(`- Frameworks: ${namedList(frameworks, options)}`);
  if (packageManagers.length > 0) {
    lines.push(`- Package managers: ${namedList(packageManagers, options)}`);
  }
  return lines;
}

function managersIn(memory: ProjectMemory, group: string[]): string[] {
  return memory.stack.packageManagers.map((pm) => pm.name).filter((name) => group.includes(name));
}

export function installLines(memory: ProjectMemory): string[] {
  return ECOSYSTEMS.flatMap((group) => {
    const managers = managersIn(memory, group);
    const install =
      managers.length === 1 && managers[0] ? INSTALL_COMMANDS[managers[0]] : undefined;
    return install ? [`- Install dependencies: ${code(install)}`] : [];
  });
}

/**
 * One line per manifest script. With exactly one JavaScript package manager
 * detected, each script is shown as the command to type (`pnpm run test`);
 * otherwise only the script name and body are shown, since picking a runner
 * would be a guess.
 */
export function scriptLines(memory: ProjectMemory): string[] {
  const managers = managersIn(memory, JAVASCRIPT_MANAGERS);
  const runner = managers.length === 1 ? managers[0] : undefined;
  return memory.commands.map((command) =>
    runner
      ? `- ${code(`${runner} run ${command.name}`)} — runs ${code(command.command)}`
      : `- ${code(command.name)} script: ${code(command.command)}`,
  );
}

const MAX_LISTED_WORKSPACES = 50;

export function architectureLines(memory: ProjectMemory, options: CitationOptions): string[] {
  const { layout, entryPoints } = memory.architecture;
  const lines: string[] = [];

  if (layout) {
    const source = options.cite ? ` (${evidenceSummary(layout.evidence)})` : '';
    const members = layout.workspaces.filter((workspace) => workspace !== '.');
    if (layout.kind === 'single-package') {
      lines.push(`- Layout: single package${source}`);
    } else {
      lines.push(`- Layout: monorepo with ${members.length} workspace packages${source}:`);
      for (const member of members.slice(0, MAX_LISTED_WORKSPACES))
        lines.push(`  - ${code(member)}`);
      if (members.length > MAX_LISTED_WORKSPACES) {
        lines.push(`  - …and ${members.length - MAX_LISTED_WORKSPACES} more (see \`memory.json\`)`);
      }
    }
  }

  for (const entry of entryPoints) {
    const owner = entry.workspace ? `of ${code(entry.workspace)}` : 'of the root package';
    lines.push(`- Entry point: ${code(entry.path)} (${code(entry.kind)} ${owner})`);
  }

  return lines;
}

function directoryLine(directory: ProjectMemory['structure']['directories'][number]): string {
  return `${code(`${directory.path}/`)} — ${directory.roles.join(', ')}`;
}

/** Top-level directories as a flat list, for a section of their own. */
export function structureLines(memory: ProjectMemory): string[] {
  return memory.structure.directories.map((directory) => `- ${directoryLine(directory)}`);
}

/** Top-level directories nested under a label, for a section shared with other content. */
export function labeledStructureLines(memory: ProjectMemory): string[] {
  const { directories } = memory.structure;
  if (directories.length === 0) return [];
  return ['- Top-level directories:', ...directories.map((d) => `  - ${directoryLine(d)}`)];
}

export function conventionLines(memory: ProjectMemory, options: CitationOptions): string[] {
  const { testing, linting } = memory.conventions;
  const lines: string[] = [];
  if (testing.length > 0) lines.push(`- Testing: ${namedList(testing, options)}`);
  if (linting.length > 0) lines.push(`- Linting and formatting: ${namedList(linting, options)}`);
  return lines;
}

export function riskLines(memory: ProjectMemory, options: CitationOptions): string[] {
  return memory.risks.map((risk) =>
    options.cite
      ? `- ${text(risk.description)} (evidence: ${evidenceSummary(risk.evidence)})`
      : `- ${text(risk.description)}`,
  );
}

export interface DependencyOptions {
  /** Include dev and peer dependencies, not just runtime ones. */
  includeDevelopment: boolean;
  /** Names listed per manifest and scope before the rest are summarized as a count. */
  maxPerGroup: number;
}

const SCOPE_LABELS: Record<Dependency['scope'], string> = {
  dependency: 'Runtime',
  devDependency: 'Development',
  peerDependency: 'Peer',
};

function dependencyGroupLine(label: string, dependencies: Dependency[], max: number): string {
  const shown = dependencies.slice(0, max).map((d) => code(`${d.name}@${d.version}`));
  const hidden = dependencies.length - shown.length;
  const more = hidden > 0 ? `, …and ${hidden} more` : '';
  return `  - ${label}: ${shown.join(', ')}${more}`;
}

export function dependencyLines(memory: ProjectMemory, options: DependencyOptions): string[] {
  const manifests = [...new Set(memory.dependencies.map((d) => d.manifest))];
  return manifests.flatMap((manifest) => {
    const declared = memory.dependencies.filter((d) => d.manifest === manifest);
    const groups = (Object.keys(SCOPE_LABELS) as Dependency['scope'][])
      .filter((scope) => options.includeDevelopment || scope === 'dependency')
      .map((scope) => ({ scope, items: declared.filter((d) => d.scope === scope) }))
      .filter((group) => group.items.length > 0);
    if (groups.length === 0) return [];
    return [
      `- ${code(manifest)}`,
      ...groups.map((group) =>
        dependencyGroupLine(SCOPE_LABELS[group.scope], group.items, options.maxPerGroup),
      ),
    ];
  });
}

const SHORT_SHA_LENGTH = 12;

/**
 * Where this file came from and how to refresh it. The commit lets an
 * assistant notice that memory predates the code it is looking at.
 */
export function provenanceLines(memory: ProjectMemory): string[] {
  const commit = memory.metadata.commit
    ? ` at commit ${code(memory.metadata.commit.value.slice(0, SHORT_SHA_LENGTH))}`
    : '';
  return [
    `> Generated by Recall from \`.recall/memory.json\`${commit}. Every statement here is backed by a file in this repository; \`memory.json\` lists the evidence for each one.`,
    '> Do not edit this file by hand — regenerate it with `npx recall-context init --force`.',
  ];
}

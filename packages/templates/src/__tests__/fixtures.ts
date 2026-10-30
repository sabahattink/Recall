import { PROJECT_MEMORY_SCHEMA_VERSION, type ProjectMemory } from '@recall-ai/schemas';

const pkg = (reason: string) => [{ path: 'package.json', reason }];

/** A memory with every category populated, used for golden output. */
export const RICH_MEMORY: ProjectMemory = {
  schemaVersion: PROJECT_MEMORY_SCHEMA_VERSION,
  metadata: {
    name: { value: 'acme-platform', evidence: pkg('name declared in package.json') },
    description: {
      value: 'Order management for Acme | internal *beta*',
      evidence: pkg('description declared in package.json'),
    },
    commit: {
      value: '0123456789abcdef0123456789abcdef01234567',
      evidence: [{ path: '.', reason: 'git HEAD resolves to this commit' }],
    },
    defaultBranch: {
      value: 'main',
      evidence: [{ path: '.', reason: 'refs/remotes/origin/HEAD points to this branch' }],
    },
    remoteUrl: {
      value: 'https://github.com/acme/platform.git',
      evidence: [{ path: '.', reason: 'URL of the git remote "origin"' }],
    },
  },
  stack: {
    languages: [
      {
        name: 'TypeScript',
        evidence: [{ path: 'tsconfig.json', reason: 'tsconfig.json present' }],
      },
    ],
    frameworks: [
      {
        name: 'nextjs',
        evidence: [
          { path: 'apps/web/next.config.ts', reason: 'next.config.ts present' },
          { path: 'apps/web/package.json', reason: 'dependency "next" declared' },
        ],
      },
      {
        name: 'nestjs',
        evidence: [{ path: 'apps/api/nest-cli.json', reason: 'nest-cli.json present' }],
      },
    ],
    packageManagers: [
      { name: 'pnpm', evidence: [{ path: 'pnpm-lock.yaml', reason: 'pnpm-lock.yaml present' }] },
    ],
  },
  architecture: {
    layout: {
      kind: 'monorepo',
      workspaces: ['.', 'apps/api', 'apps/web', 'packages/ui'],
      evidence: [{ path: 'pnpm-workspace.yaml', reason: 'pnpm-workspace.yaml present' }],
    },
    entryPoints: [
      {
        path: 'apps/api/dist/main.js',
        kind: 'main',
        workspace: 'apps/api',
        evidence: [{ path: 'apps/api/package.json', reason: '"main" field declared' }],
      },
    ],
  },
  structure: {
    directories: [
      {
        path: 'apps',
        roles: ['source', 'test', 'config'],
        evidence: [{ path: 'apps/api/src/main.ts', reason: 'matches the source file pattern' }],
      },
      {
        path: 'docs',
        roles: ['documentation'],
        evidence: [{ path: 'docs/adr-001.md', reason: 'matches the documentation file pattern' }],
      },
    ],
  },
  commands: [
    {
      name: 'build',
      command: 'turbo run build',
      evidence: pkg('scripts.build declared as "turbo run build"'),
    },
    {
      name: 'test',
      command: 'turbo run test -- --reporter=`dot`',
      evidence: pkg('scripts.test declared'),
    },
  ],
  conventions: {
    testing: [{ name: 'vitest', evidence: pkg('dependency "vitest" declared') }],
    linting: [
      {
        name: 'eslint',
        evidence: [
          { path: 'package.json', reason: 'dependency "eslint" declared' },
          { path: 'eslint.config.js', reason: 'eslint.config.js present' },
        ],
      },
    ],
  },
  dependencies: [
    {
      name: 'next',
      version: '15.1.0',
      scope: 'dependency',
      manifest: 'apps/web/package.json',
      evidence: [{ path: 'apps/web/package.json', reason: 'dependencies.next declared' }],
    },
    {
      name: 'zod',
      version: '^3.24.1',
      scope: 'dependency',
      manifest: 'package.json',
      evidence: pkg('dependencies.zod declared'),
    },
    {
      name: 'typescript',
      version: '^5.7.2',
      scope: 'devDependency',
      manifest: 'package.json',
      evidence: pkg('devDependencies.typescript declared'),
    },
  ],
  risks: [
    {
      id: 'no-license',
      description: 'No license file was found at the repository root.',
      evidence: [
        { path: '.', reason: 'no LICENSE, LICENCE, or COPYING file at the repository root' },
      ],
    },
    {
      id: 'env-file-not-ignored',
      description:
        'Environment files are not ignored by the root .gitignore and may contain secrets.',
      evidence: [{ path: 'apps/api/.env', reason: 'present and not matched by .gitignore' }],
    },
  ],
};

/** A memory with no claims at all — what an empty directory produces. */
export const EMPTY_MEMORY: ProjectMemory = {
  schemaVersion: PROJECT_MEMORY_SCHEMA_VERSION,
  metadata: { name: null, description: null, commit: null, defaultBranch: null, remoteUrl: null },
  stack: { languages: [], frameworks: [], packageManagers: [] },
  architecture: { layout: null, entryPoints: [] },
  structure: { directories: [] },
  commands: [],
  conventions: { testing: [], linting: [] },
  dependencies: [],
  risks: [],
};

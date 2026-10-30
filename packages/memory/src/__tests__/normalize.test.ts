import { describe, expect, it } from 'vitest';
import type { Fact, FactCollection } from '@recall-ai/schemas';
import { normalizeFacts } from '../normalize.js';

function ev(path: string, reason = 'test evidence') {
  return [{ path, reason }];
}

const EMPTY = normalizeFacts([]);

describe('normalizeFacts', () => {
  it('produces an all-empty memory from no facts, never an error or a default claim', () => {
    expect(EMPTY).toEqual({
      schemaVersion: '1.0.0',
      metadata: {
        name: null,
        description: null,
        commit: null,
        defaultBranch: null,
        remoteUrl: null,
      },
      stack: { languages: [], frameworks: [], packageManagers: [] },
      architecture: { layout: null, entryPoints: [] },
      structure: { directories: [] },
      commands: [],
      conventions: { testing: [], linting: [] },
      dependencies: [],
      risks: [],
    });
  });

  describe('metadata', () => {
    it('maps each repository-metadata key to its traced value', () => {
      const memory = normalizeFacts([
        {
          category: 'repository-metadata',
          value: { key: 'name', value: 'acme' },
          evidence: ev('package.json'),
        },
        {
          category: 'repository-metadata',
          value: { key: 'commit', value: 'a'.repeat(40) },
          evidence: ev('.'),
        },
        {
          category: 'repository-metadata',
          value: { key: 'default-branch', value: 'main' },
          evidence: ev('.'),
        },
        {
          category: 'repository-metadata',
          value: { key: 'remote-url', value: 'https://x/y.git' },
          evidence: ev('.'),
        },
      ]);
      expect(memory.metadata).toEqual({
        name: { value: 'acme', evidence: ev('package.json') },
        description: null,
        commit: { value: 'a'.repeat(40), evidence: ev('.') },
        defaultBranch: { value: 'main', evidence: ev('.') },
        remoteUrl: { value: 'https://x/y.git', evidence: ev('.') },
      });
    });
  });

  describe('stack', () => {
    it('keeps scanner priority order and merges evidence for a repeated name', () => {
      const memory = normalizeFacts([
        { category: 'language', value: 'TypeScript', evidence: ev('tsconfig.json') },
        { category: 'language', value: 'JavaScript', evidence: ev('a.js') },
        { category: 'framework', value: 'nextjs', evidence: ev('next.config.ts') },
        { category: 'framework', value: 'nextjs', evidence: ev('package.json') },
        { category: 'package-manager', value: 'pnpm', evidence: ev('pnpm-lock.yaml') },
      ]);
      expect(memory.stack).toEqual({
        languages: [
          { name: 'TypeScript', evidence: ev('tsconfig.json') },
          { name: 'JavaScript', evidence: ev('a.js') },
        ],
        frameworks: [
          { name: 'nextjs', evidence: [...ev('next.config.ts'), ...ev('package.json')] },
        ],
        packageManagers: [{ name: 'pnpm', evidence: ev('pnpm-lock.yaml') }],
      });
    });
  });

  describe('architecture', () => {
    it('classifies a single-entry layout as single-package', () => {
      const memory = normalizeFacts([
        { category: 'workspace-layout', value: ['.'], evidence: ev('package.json') },
      ]);
      expect(memory.architecture.layout).toEqual({
        kind: 'single-package',
        workspaces: ['.'],
        evidence: ev('package.json'),
      });
    });

    it('classifies a multi-entry layout as a monorepo and sorts entry points', () => {
      const memory = normalizeFacts([
        {
          category: 'workspace-layout',
          value: ['.', 'apps/web'],
          evidence: ev('pnpm-workspace.yaml'),
        },
        {
          category: 'architecture-hint',
          value: { path: 'z/main.js', kind: 'main', workspace: 'z' },
          evidence: ev('z/package.json'),
        },
        {
          category: 'architecture-hint',
          value: { path: 'a/bin.js', kind: 'bin', workspace: 'a' },
          evidence: ev('a/package.json'),
        },
      ]);
      expect(memory.architecture.layout?.kind).toBe('monorepo');
      expect(memory.architecture.entryPoints.map((e) => e.path)).toEqual(['a/bin.js', 'z/main.js']);
    });

    it('merges entry points that share a path, kind, and workspace, keeping all evidence', () => {
      const memory = normalizeFacts([
        {
          category: 'architecture-hint',
          value: { path: 'dist/index.js', kind: 'bin', workspace: null },
          evidence: ev('package.json', 'bin entry "tool" declared'),
        },
        {
          category: 'architecture-hint',
          value: { path: 'dist/index.js', kind: 'bin', workspace: null },
          evidence: ev('package.json', 'bin entry "tool-alias" declared'),
        },
        {
          category: 'architecture-hint',
          value: { path: 'dist/index.js', kind: 'main', workspace: null },
          evidence: ev('package.json', 'main declared'),
        },
      ]);
      expect(memory.architecture.entryPoints).toEqual([
        {
          path: 'dist/index.js',
          kind: 'bin',
          workspace: null,
          evidence: [
            ...ev('package.json', 'bin entry "tool" declared'),
            ...ev('package.json', 'bin entry "tool-alias" declared'),
          ],
        },
        {
          path: 'dist/index.js',
          kind: 'main',
          workspace: null,
          evidence: ev('package.json', 'main declared'),
        },
      ]);
    });
  });

  describe('structure', () => {
    it('merges per-role directory facts into one entry per path, roles in schema order', () => {
      const memory = normalizeFacts([
        {
          category: 'directory',
          value: { path: 'src', role: 'test' },
          evidence: ev('src/a.test.ts'),
        },
        {
          category: 'directory',
          value: { path: 'docs', role: 'documentation' },
          evidence: ev('docs/a.md'),
        },
        { category: 'directory', value: { path: 'src', role: 'source' }, evidence: ev('src/a.ts') },
      ]);
      expect(memory.structure.directories).toEqual([
        { path: 'docs', roles: ['documentation'], evidence: ev('docs/a.md') },
        {
          path: 'src',
          roles: ['source', 'test'],
          evidence: [...ev('src/a.ts'), ...ev('src/a.test.ts')],
        },
      ]);
    });
  });

  describe('commands', () => {
    it('keeps command facts in scanner order', () => {
      const memory = normalizeFacts([
        {
          category: 'command',
          value: { name: 'build', command: 'tsc -b' },
          evidence: ev('package.json'),
        },
        {
          category: 'command',
          value: { name: 'test', command: 'vitest run' },
          evidence: ev('package.json'),
        },
      ]);
      expect(memory.commands).toEqual([
        { name: 'build', command: 'tsc -b', evidence: ev('package.json') },
        { name: 'test', command: 'vitest run', evidence: ev('package.json') },
      ]);
    });
  });

  describe('conventions', () => {
    it('collects testing frameworks and lint/format tooling', () => {
      const memory = normalizeFacts([
        { category: 'testing-framework', value: 'vitest', evidence: ev('package.json') },
        { category: 'linting', value: 'eslint', evidence: ev('eslint.config.js') },
      ]);
      expect(memory.conventions).toEqual({
        testing: [{ name: 'vitest', evidence: ev('package.json') }],
        linting: [{ name: 'eslint', evidence: ev('eslint.config.js') }],
      });
    });
  });

  describe('dependencies', () => {
    it('records the declaring manifest and sorts by manifest, scope, then name', () => {
      const dep = (
        name: string,
        scope: 'dependency' | 'devDependency',
        manifest: string,
      ): Fact => ({
        category: 'dependency',
        value: { name, version: '^1.0.0', scope },
        evidence: ev(manifest),
      });
      const memory = normalizeFacts([
        dep('zod', 'devDependency', 'package.json'),
        dep('react', 'dependency', 'apps/web/package.json'),
        dep('b', 'dependency', 'package.json'),
        dep('a', 'dependency', 'package.json'),
      ]);
      expect(memory.dependencies.map((d) => `${d.manifest}:${d.scope}:${d.name}`)).toEqual([
        'apps/web/package.json:dependency:react',
        'package.json:dependency:a',
        'package.json:dependency:b',
        'package.json:devDependency:zod',
      ]);
    });
  });

  describe('risks', () => {
    it('maps risk indicators to risks in scanner order', () => {
      const memory = normalizeFacts([
        {
          category: 'risk-indicator',
          value: { id: 'no-license', description: 'No license.' },
          evidence: ev('.'),
        },
      ]);
      expect(memory.risks).toEqual([
        { id: 'no-license', description: 'No license.', evidence: ev('.') },
      ]);
    });
  });

  it('is pure: identical input produces deeply equal output and leaves the input untouched', () => {
    const facts: FactCollection = [
      { category: 'directory', value: { path: 'src', role: 'source' }, evidence: ev('src/a.ts') },
      { category: 'language', value: 'TypeScript', evidence: ev('tsconfig.json') },
    ];
    const snapshot = structuredClone(facts);
    expect(normalizeFacts(facts)).toEqual(normalizeFacts(facts));
    expect(facts).toEqual(snapshot);
  });
});

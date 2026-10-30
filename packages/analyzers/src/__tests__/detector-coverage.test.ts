import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FactCollectionSchema, type Fact } from '@recall-ai/schemas';
import { createTempDir, removeTempDir, writeTree, type FileTree } from '@recall-ai/test-fixtures';
import { walkRepository } from '../file-walk.js';
import { detectFrameworkFacts } from '../framework-facts.js';
import { detectCommandAndToolingFacts } from '../command-tooling-facts.js';
import { detectDependencyFacts } from '../dependency-facts.js';
import { detectArchitectureHintFacts } from '../architecture-hint-facts.js';

type Detector = (
  files: Awaited<ReturnType<typeof walkRepository>>['files'],
  root: string,
) => Promise<Fact[]>;

describe('detector coverage and robustness', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  async function run(detector: Detector, tree: FileTree): Promise<Fact[]> {
    await writeTree(dir, tree);
    const { files } = await walkRepository(dir);
    const facts = await detector(files, dir);
    expect(FactCollectionSchema.safeParse(facts).success).toBe(true);
    return facts;
  }

  const pkg = (body: Record<string, unknown>) => ({ 'package.json': JSON.stringify(body) });

  describe('frameworks', () => {
    it('suppresses the UI library a meta-framework is built on', async () => {
      const facts = await run(
        detectFrameworkFacts,
        pkg({ dependencies: { nuxt: '3', vue: '3', '@sveltejs/kit': '2', svelte: '5' } }),
      );
      expect(facts.map((f) => f.value)).toEqual(['nuxt', 'sveltekit']);
    });

    it('detects Angular from angular.json alone', async () => {
      const facts = await run(detectFrameworkFacts, { 'angular.json': '{}' });
      expect(facts.map((f) => f.value)).toEqual(['angular']);
    });

    it('ignores a dependencies field that is not an object', async () => {
      expect(await run(detectFrameworkFacts, pkg({ dependencies: ['react'] }))).toEqual([]);
    });
  });

  describe('commands and tooling', () => {
    it('reports start, typecheck, and format scripts after the blueprint five', async () => {
      const facts = await run(
        detectCommandAndToolingFacts,
        pkg({
          scripts: { format: 'prettier -w .', typecheck: 'tsc', start: 'node .', test: 'vitest' },
        }),
      );
      expect(
        facts
          .filter((f) => f.category === 'command')
          .map((f) => (f.value as { name: string }).name),
      ).toEqual(['test', 'start', 'typecheck', 'format']);
    });

    it('skips a script whose body is not a string', async () => {
      const facts = await run(
        detectCommandAndToolingFacts,
        pkg({ scripts: { build: 42, test: 'vitest' } }),
      );
      expect(facts.map((f) => f.value)).toEqual([{ name: 'test', command: 'vitest' }]);
    });

    it('detects Prettier and Biome from config files or dependencies', async () => {
      const facts = await run(detectCommandAndToolingFacts, {
        ...pkg({ devDependencies: { '@biomejs/biome': '1' } }),
        '.prettierrc.json': '{}',
      });
      expect(facts.filter((f) => f.category === 'linting')).toEqual([
        {
          category: 'linting',
          value: 'prettier',
          evidence: [{ path: '.prettierrc.json', reason: '.prettierrc.json present' }],
        },
        {
          category: 'linting',
          value: 'biome',
          evidence: [{ path: 'package.json', reason: 'dependency "@biomejs/biome" declared' }],
        },
      ]);
    });
  });

  describe('dependencies', () => {
    it('skips a declaration whose version is not a string', async () => {
      const facts = await run(
        detectDependencyFacts,
        pkg({ dependencies: { good: '^1.0.0', bad: { version: '1' } } }),
      );
      expect(facts.map((f) => f.value)).toEqual([
        { name: 'good', version: '^1.0.0', scope: 'dependency' },
      ]);
    });
  });

  describe('entry points', () => {
    it('skips non-string bin entries and a non-string main', async () => {
      const facts = await run(
        detectArchitectureHintFacts,
        pkg({ name: 'tool', bin: { ok: './cli.js', broken: 7 }, main: false }),
      );
      expect(facts.filter((f) => f.category === 'architecture-hint').map((f) => f.value)).toEqual([
        { path: 'cli.js', kind: 'bin', workspace: null },
      ]);
    });
  });

  describe('directory roles', () => {
    it('recognizes Python, Go, and generated files', async () => {
      const facts = await run(detectArchitectureHintFacts, {
        'service/app.py': '',
        'service/test_app.py': '',
        'tool/main_test.go': '',
        'api/__generated__/schema.ts': '',
      });
      const roles = facts
        .filter((f) => f.category === 'directory')
        .map((f) => `${(f.value as { path: string }).path}:${(f.value as { role: string }).role}`);
      expect(roles).toEqual([
        'api:source',
        'api:generated',
        'service:source',
        'service:test',
        'tool:source',
        'tool:test',
      ]);
    });
  });
});

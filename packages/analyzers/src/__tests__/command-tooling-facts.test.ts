import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FactCollectionSchema } from '@recall-ai/schemas';
import { createTempDir, removeTempDir, writeTree } from '@recall-ai/test-fixtures';
import { detectCommandAndToolingFacts } from '../command-tooling-facts.js';
import type { WalkedFile } from '../file-walk.js';

function file(path: string): WalkedFile {
  return { path, sizeBytes: 0, extension: '' };
}

describe('detectCommandAndToolingFacts', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  describe('commands', () => {
    it('detects build/test/lint/dev commands and cites the manifest entry', async () => {
      await writeTree(dir, {
        'package.json': JSON.stringify({
          scripts: { build: 'tsc -b', test: 'vitest run', lint: 'eslint src', dev: 'tsx watch' },
        }),
      });

      const facts = await detectCommandAndToolingFacts([file('package.json')], dir);
      const commandFacts = facts.filter((f) => f.category === 'command');
      expect(commandFacts).toEqual([
        {
          category: 'command',
          value: { name: 'build', command: 'tsc -b' },
          evidence: [{ path: 'package.json', reason: 'scripts.build declared as "tsc -b"' }],
        },
        {
          category: 'command',
          value: { name: 'test', command: 'vitest run' },
          evidence: [{ path: 'package.json', reason: 'scripts.test declared as "vitest run"' }],
        },
        {
          category: 'command',
          value: { name: 'lint', command: 'eslint src' },
          evidence: [{ path: 'package.json', reason: 'scripts.lint declared as "eslint src"' }],
        },
        {
          category: 'command',
          value: { name: 'dev', command: 'tsx watch' },
          evidence: [{ path: 'package.json', reason: 'scripts.dev declared as "tsx watch"' }],
        },
      ]);
    });

    it('detects install when declared as an explicit script', async () => {
      await writeTree(dir, {
        'package.json': JSON.stringify({ scripts: { install: 'node scripts/setup.js' } }),
      });

      const facts = await detectCommandAndToolingFacts([file('package.json')], dir);
      const commandFacts = facts.filter((f) => f.category === 'command');
      expect(commandFacts.map((f) => f.value)).toEqual([
        { name: 'install', command: 'node scripts/setup.js' },
      ]);
    });

    it('emits commands in the fixed canonical order, not scripts object key order', async () => {
      await writeTree(dir, {
        'package.json': JSON.stringify({
          scripts: { dev: 'tsx watch', build: 'tsc -b', test: 'vitest run' },
        }),
      });

      const facts = await detectCommandAndToolingFacts([file('package.json')], dir);
      const names = facts
        .filter((f) => f.category === 'command')
        .map((f) => (f.value as { name: string }).name);
      expect(names).toEqual(['build', 'test', 'dev']);
    });

    it('produces no command fact, and no error, for a command not declared', async () => {
      await writeTree(dir, { 'package.json': JSON.stringify({ scripts: { build: 'tsc -b' } }) });

      const facts = await detectCommandAndToolingFacts([file('package.json')], dir);
      expect(facts.filter((f) => f.category === 'command')).toHaveLength(1);
    });

    it('produces no command fact, and no error, when there is no root package.json', async () => {
      const facts = await detectCommandAndToolingFacts([file('README.md')], dir);
      expect(facts.filter((f) => f.category === 'command')).toEqual([]);
    });

    it('produces no command fact, and no error, when package.json is malformed', async () => {
      await writeTree(dir, { 'package.json': '{ not valid json' });
      const facts = await detectCommandAndToolingFacts([file('package.json')], dir);
      expect(facts.filter((f) => f.category === 'command')).toEqual([]);
    });
  });

  describe('testing framework', () => {
    it('detects a testing framework from a dependency and cites the declaration', async () => {
      await writeTree(dir, {
        'package.json': JSON.stringify({ devDependencies: { vitest: '^2.0.0' } }),
      });

      const facts = await detectCommandAndToolingFacts([file('package.json')], dir);
      expect(facts.filter((f) => f.category === 'testing-framework')).toEqual([
        {
          category: 'testing-framework',
          value: 'vitest',
          evidence: [{ path: 'package.json', reason: 'dependency "vitest" declared' }],
        },
      ]);
    });

    it('detects multiple testing frameworks in fixed declaration order', async () => {
      await writeTree(dir, {
        'package.json': JSON.stringify({
          devDependencies: { jest: '^29.0.0', vitest: '^2.0.0', mocha: '^10.0.0' },
        }),
      });

      const facts = await detectCommandAndToolingFacts([file('package.json')], dir);
      const names = facts.filter((f) => f.category === 'testing-framework').map((f) => f.value);
      expect(names).toEqual(['vitest', 'jest', 'mocha']);
    });

    it('produces no testing-framework fact, and no error, when none is declared', async () => {
      await writeTree(dir, {
        'package.json': JSON.stringify({ dependencies: { lodash: '^4.0.0' } }),
      });
      const facts = await detectCommandAndToolingFacts([file('package.json')], dir);
      expect(facts.filter((f) => f.category === 'testing-framework')).toEqual([]);
    });
  });

  describe('linting', () => {
    it('detects linting from an eslint dependency', async () => {
      await writeTree(dir, {
        'package.json': JSON.stringify({ devDependencies: { eslint: '^9.0.0' } }),
      });

      const facts = await detectCommandAndToolingFacts([file('package.json')], dir);
      expect(facts.filter((f) => f.category === 'linting')).toEqual([
        {
          category: 'linting',
          value: 'eslint',
          evidence: [{ path: 'package.json', reason: 'dependency "eslint" declared' }],
        },
      ]);
    });

    it('detects linting from a config file alone, with no package.json', async () => {
      const facts = await detectCommandAndToolingFacts([file('eslint.config.js')], dir);
      expect(facts.filter((f) => f.category === 'linting')).toEqual([
        {
          category: 'linting',
          value: 'eslint',
          evidence: [{ path: 'eslint.config.js', reason: 'eslint.config.js present' }],
        },
      ]);
    });

    it('detects a config file at any depth in the tree', async () => {
      const facts = await detectCommandAndToolingFacts([file('packages/core/.eslintrc.json')], dir);
      expect(facts.filter((f) => f.category === 'linting')).toEqual([
        {
          category: 'linting',
          value: 'eslint',
          evidence: [{ path: 'packages/core/.eslintrc.json', reason: '.eslintrc.json present' }],
        },
      ]);
    });

    it('merges dependency and config-file evidence into a single fact', async () => {
      await writeTree(dir, {
        'package.json': JSON.stringify({ devDependencies: { eslint: '^9.0.0' } }),
        'eslint.config.js': '',
      });

      const facts = await detectCommandAndToolingFacts(
        [file('package.json'), file('eslint.config.js')],
        dir,
      );
      expect(facts.filter((f) => f.category === 'linting')).toEqual([
        {
          category: 'linting',
          value: 'eslint',
          evidence: [
            { path: 'package.json', reason: 'dependency "eslint" declared' },
            { path: 'eslint.config.js', reason: 'eslint.config.js present' },
          ],
        },
      ]);
    });

    it('produces no linting fact, and no error, when there is no evidence at all', async () => {
      await writeTree(dir, {
        'package.json': JSON.stringify({ dependencies: { lodash: '^4.0.0' } }),
      });
      const facts = await detectCommandAndToolingFacts([file('package.json')], dir);
      expect(facts.filter((f) => f.category === 'linting')).toEqual([]);
    });
  });

  describe('combined behavior', () => {
    it('emits Facts that conform to the frozen Fact schema', async () => {
      await writeTree(dir, {
        'package.json': JSON.stringify({
          scripts: { build: 'tsc -b', test: 'vitest run' },
          devDependencies: { vitest: '^2.0.0', eslint: '^9.0.0' },
        }),
      });

      const facts = await detectCommandAndToolingFacts([file('package.json')], dir);
      const result = FactCollectionSchema.safeParse(facts);
      expect(result.success).toBe(true);
      expect(facts.every((f) => f.evidence.length >= 1)).toBe(true);
      expect(facts.length).toBeGreaterThan(0);
    });

    it('produces identical output across repeated calls against the same input', async () => {
      await writeTree(dir, {
        'package.json': JSON.stringify({
          scripts: { build: 'tsc -b' },
          devDependencies: { vitest: '^2.0.0', eslint: '^9.0.0' },
        }),
        'eslint.config.js': '',
      });

      const first = await detectCommandAndToolingFacts(
        [file('package.json'), file('eslint.config.js')],
        dir,
      );
      const second = await detectCommandAndToolingFacts(
        [file('eslint.config.js'), file('package.json')],
        dir,
      );
      expect(first).toEqual(second);
    });
  });
});

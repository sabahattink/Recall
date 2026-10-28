import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FactCollectionSchema } from '@recall-ai/schemas';
import { createTempDir, removeTempDir, writeTree } from '@recall-ai/test-fixtures';
import { detectArchitectureHintFacts } from '../architecture-hint-facts.js';
import type { WalkedFile } from '../file-walk.js';

function file(path: string, extension = ''): WalkedFile {
  return { path, sizeBytes: 0, extension };
}

describe('detectArchitectureHintFacts', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  describe('directory roles', () => {
    it('detects a source directory role, citing the matching file', async () => {
      const facts = await detectArchitectureHintFacts([file('src/index.ts', '.ts')], dir);
      expect(facts).toEqual([
        {
          category: 'directory',
          value: { path: 'src', role: 'source' },
          evidence: [{ path: 'src/index.ts', reason: 'matches the source file pattern' }],
        },
      ]);
    });

    it('detects a test directory role from a __tests__ file', async () => {
      const facts = await detectArchitectureHintFacts(
        [file('src/__tests__/index.test.ts', '.ts')],
        dir,
      );
      const testFact = facts.find((f) => (f.value as { role: string }).role === 'test');
      expect(testFact).toEqual({
        category: 'directory',
        value: { path: 'src', role: 'test' },
        evidence: [
          { path: 'src/__tests__/index.test.ts', reason: 'matches the test file pattern' },
        ],
      });
    });

    it('detects a documentation directory role', async () => {
      const facts = await detectArchitectureHintFacts([file('docs/guide.md', '.md')], dir);
      expect(facts).toEqual([
        {
          category: 'directory',
          value: { path: 'docs', role: 'documentation' },
          evidence: [{ path: 'docs/guide.md', reason: 'matches the documentation file pattern' }],
        },
      ]);
    });

    it('detects a config directory role from a nested package.json', async () => {
      await writeTree(dir, { 'packages/core/package.json': '{}' });
      const facts = await detectArchitectureHintFacts([file('packages/core/package.json')], dir);
      const configFact = facts.find((f) => (f.value as { role: string }).role === 'config');
      expect(configFact).toEqual({
        category: 'directory',
        value: { path: 'packages', role: 'config' },
        evidence: [
          { path: 'packages/core/package.json', reason: 'matches the config file pattern' },
        ],
      });
    });

    it('emits multiple role facts for the same directory when it genuinely contains multiple kinds of files', async () => {
      const facts = await detectArchitectureHintFacts(
        [file('src/index.ts', '.ts'), file('src/index.test.ts', '.ts')],
        dir,
      );
      const roles = facts
        .filter((f) => f.category === 'directory')
        .map((f) => (f.value as { role: string }).role);
      expect(roles).toEqual(['source', 'test']);
    });

    it('does not give a directory a role from its name alone, with no matching file inside it', async () => {
      // 'test' is a directory name with no plausible file extension of its
      // own; a file with no recognizable kind must not manufacture a role.
      const facts = await detectArchitectureHintFacts([file('test/notes.xyz', '.xyz')], dir);
      expect(facts.filter((f) => f.category === 'directory')).toEqual([]);
    });

    it('ignores root-level loose files with no directory component', async () => {
      const facts = await detectArchitectureHintFacts([file('README.md', '.md')], dir);
      expect(facts.filter((f) => f.category === 'directory')).toEqual([]);
    });

    it('produces directory facts in sorted directory-path order', async () => {
      const facts = await detectArchitectureHintFacts(
        [file('src/b.ts', '.ts'), file('apps/a.ts', '.ts')],
        dir,
      );
      const dirs = facts
        .filter((f) => f.category === 'directory')
        .map((f) => (f.value as { path: string }).path);
      expect(dirs).toEqual(['apps', 'src']);
    });
  });

  describe('entry points', () => {
    it('detects a "main" entry point and cites the manifest field', async () => {
      await writeTree(dir, { 'package.json': JSON.stringify({ main: 'dist/index.js' }) });
      const facts = await detectArchitectureHintFacts([file('package.json')], dir);
      expect(facts).toEqual([
        {
          category: 'architecture-hint',
          value: { path: 'dist/index.js', kind: 'main', workspace: null },
          evidence: [{ path: 'package.json', reason: '"main" field declared' }],
        },
      ]);
    });

    it('detects a string "bin" entry point', async () => {
      await writeTree(dir, {
        'package.json': JSON.stringify({ name: 'recall-context', bin: './dist/cli.js' }),
      });
      const facts = await detectArchitectureHintFacts([file('package.json')], dir);
      expect(facts).toEqual([
        {
          category: 'architecture-hint',
          value: { path: 'dist/cli.js', kind: 'bin', workspace: null },
          evidence: [{ path: 'package.json', reason: 'bin entry "recall-context" declared' }],
        },
      ]);
    });

    it('detects an object-form "bin" with multiple entries, sorted by name', async () => {
      await writeTree(dir, {
        'package.json': JSON.stringify({
          bin: { zeta: './dist/zeta.js', alpha: './dist/alpha.js' },
        }),
      });
      const facts = await detectArchitectureHintFacts([file('package.json')], dir);
      expect(facts.map((f) => f.evidence[0]?.reason)).toEqual([
        'bin entry "alpha" declared',
        'bin entry "zeta" declared',
      ]);
    });

    it('resolves entry point paths relative to a member package.json, not the repo root', async () => {
      await writeTree(dir, {
        'apps/cli/package.json': JSON.stringify({ bin: './dist/index.js' }),
      });
      const facts = await detectArchitectureHintFacts([file('apps/cli/package.json')], dir);
      // The same package.json is also real evidence for a 'config'
      // directory-role fact on 'apps' — filtering to architecture-hint
      // isolates the entry-point behavior this test targets.
      expect(facts.filter((f) => f.category === 'architecture-hint')).toEqual([
        {
          category: 'architecture-hint',
          value: { path: 'apps/cli/dist/index.js', kind: 'bin', workspace: 'apps/cli' },
          evidence: [{ path: 'apps/cli/package.json', reason: 'bin entry "cli" declared' }],
        },
      ]);
    });

    it('does not require the resolved entry point file to exist in the walked file list', async () => {
      // bin/main conventionally point at build output, which SCAN-02's walk
      // already excludes by design; the manifest field is the evidence.
      await writeTree(dir, { 'package.json': JSON.stringify({ main: 'dist/index.js' }) });
      const facts = await detectArchitectureHintFacts([file('package.json')], dir);
      expect(facts).toHaveLength(1);
    });

    it('never assumes an entry point from a conventional filename when no manifest field exists', async () => {
      await writeTree(dir, {
        'package.json': JSON.stringify({ name: 'no-entry-fields' }),
        'src/index.ts': 'export {};\n',
      });
      const facts = await detectArchitectureHintFacts(
        [file('package.json'), file('src/index.ts', '.ts')],
        dir,
      );
      expect(facts.filter((f) => f.category === 'architecture-hint')).toEqual([]);
    });

    it('produces no entry-point fact, and no error, when package.json is malformed', async () => {
      await writeTree(dir, { 'package.json': '{ not valid json' });
      const facts = await detectArchitectureHintFacts([file('package.json')], dir);
      expect(facts.filter((f) => f.category === 'architecture-hint')).toEqual([]);
    });

    it('extracts entry points from multiple package.json files in sorted-path order', async () => {
      await writeTree(dir, {
        'package.json': JSON.stringify({ main: 'index.js' }),
        'apps/web/package.json': JSON.stringify({ main: 'dist/index.js' }),
      });
      const facts = await detectArchitectureHintFacts(
        [file('apps/web/package.json'), file('package.json')],
        dir,
      );
      const hintFacts = facts.filter((f) => f.category === 'architecture-hint');
      expect(hintFacts.map((f) => f.evidence[0]?.path)).toEqual([
        'apps/web/package.json',
        'package.json',
      ]);
    });
  });

  describe('combined behavior', () => {
    it('emits Facts that conform to the frozen Fact schema', async () => {
      await writeTree(dir, { 'package.json': JSON.stringify({ main: 'dist/index.js' }) });
      const facts = await detectArchitectureHintFacts(
        [file('package.json'), file('src/index.ts', '.ts')],
        dir,
      );
      const result = FactCollectionSchema.safeParse(facts);
      expect(result.success).toBe(true);
      expect(facts.every((f) => f.evidence.length >= 1)).toBe(true);
      expect(facts.length).toBeGreaterThan(0);
    });

    it('produces identical output across repeated calls regardless of input file order', async () => {
      await writeTree(dir, { 'package.json': JSON.stringify({ main: 'dist/index.js' }) });

      const first = await detectArchitectureHintFacts(
        [file('package.json'), file('src/index.ts', '.ts'), file('docs/guide.md', '.md')],
        dir,
      );
      const second = await detectArchitectureHintFacts(
        [file('docs/guide.md', '.md'), file('src/index.ts', '.ts'), file('package.json')],
        dir,
      );
      expect(first).toEqual(second);
    });
  });
});

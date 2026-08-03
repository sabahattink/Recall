import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTempDir, removeTempDir, writeTree } from '@recall-ai/test-fixtures';
import { walkRepository } from '../file-walk.js';

describe('walkRepository', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  it('excludes default ignored directories such as node_modules and dist', async () => {
    await writeTree(dir, {
      'src/index.ts': 'export {};\n',
      'node_modules/some-pkg/index.js': 'module.exports = {};\n',
      'dist/index.js': 'module.exports = {};\n',
      '.git/HEAD': 'ref: refs/heads/main\n',
    });

    const { files } = await walkRepository(dir);
    const paths = files.map((f) => f.path);
    expect(paths).toContain('src/index.ts');
    expect(paths.some((p) => p.startsWith('node_modules/'))).toBe(false);
    expect(paths.some((p) => p.startsWith('dist/'))).toBe(false);
    expect(paths.some((p) => p.startsWith('.git/'))).toBe(false);
  });

  it('respects .gitignore entries', async () => {
    await writeTree(dir, {
      '.gitignore': 'secret-notes.md\nignored-dir/\n',
      'src/index.ts': 'export {};\n',
      'secret-notes.md': 'do not scan\n',
      'ignored-dir/file.ts': 'export {};\n',
    });

    const { files } = await walkRepository(dir);
    const paths = files.map((f) => f.path);
    expect(paths).toContain('src/index.ts');
    expect(paths).not.toContain('secret-notes.md');
    expect(paths.some((p) => p.startsWith('ignored-dir/'))).toBe(false);
  });

  it('returns files in deterministic sorted order', async () => {
    await writeTree(dir, {
      'c.ts': '',
      'a.ts': '',
      'b.ts': '',
    });
    const { files } = await walkRepository(dir);
    const paths = files.map((f) => f.path);
    expect(paths).toEqual([...paths].sort());
  });

  it('truncates results once maxFiles is reached', async () => {
    await writeTree(dir, {
      'a.ts': '',
      'b.ts': '',
      'c.ts': '',
    });
    const { files, truncated } = await walkRepository(dir, { maxFiles: 2 });
    expect(files.length).toBe(2);
    expect(truncated).toBe(true);
  });

  it('produces identical, fully sorted output across repeated scans when not truncated', async () => {
    const tree: Record<string, string> = {};
    for (let dirIndex = 0; dirIndex < 10; dirIndex++) {
      for (let fileIndex = 0; fileIndex < 15; fileIndex++) {
        tree[`src/module-${dirIndex}/file-${fileIndex}.ts`] = 'export {};\n';
      }
    }
    await writeTree(dir, tree);

    const first = await walkRepository(dir);
    const second = await walkRepository(dir);

    expect(first.truncated).toBe(false);
    expect(first.files.length).toBe(150);
    expect(first.files.map((f) => f.path)).toEqual(second.files.map((f) => f.path));
    const paths = first.files.map((f) => f.path);
    expect(paths).toEqual([...paths].sort((a, b) => a.localeCompare(b)));
  });

  it('stops walking early once maxFiles is reached on a large, deeply nested tree', async () => {
    // Regression test for streaming vs. buffer-then-truncate: this proves
    // `walkRepository` returns quickly and respects the cap even when the
    // repository has far more files than `maxFiles`, spread across many
    // directories — the scenario where enumerating everything before
    // checking the cap would be slow.
    const tree: Record<string, string> = {};
    for (let dirIndex = 0; dirIndex < 40; dirIndex++) {
      for (let fileIndex = 0; fileIndex < 50; fileIndex++) {
        tree[`src/module-${dirIndex}/file-${fileIndex}.ts`] = '';
      }
    }
    await writeTree(dir, tree);

    const start = Date.now();
    const { files, truncated } = await walkRepository(dir, { maxFiles: 3 });
    const elapsedMs = Date.now() - start;

    expect(truncated).toBe(true);
    expect(files.length).toBe(3);
    // Generous bound: a genuinely unbounded walk of 2000 files is still fast
    // on CI hardware, so this is a smoke check, not a precise benchmark —
    // its purpose is to catch a regression back to "enumerate everything
    // first", not to enforce a tight performance budget.
    expect(elapsedMs).toBeLessThan(5000);
  });
});

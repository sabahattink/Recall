import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTempDir, removeTempDir, writeTree } from '@recall-ai/test-fixtures';
import { walkRepository } from '../file-walk.js';
import { collectTruncated } from '../file-walk-internal.js';

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
    // Small enough to be near-instant on a slow CI filesystem (each entry
    // costs a real mkdir+writeFile via writeTree), while still covering a
    // nested directory and a dotfile — the two cases most likely to break
    // sorting or enumeration if `walkRepository` regresses.
    await writeTree(dir, {
      'root.ts': 'export {};\n',
      'src/b.ts': 'export {};\n',
      'src/a.ts': 'export {};\n',
      'src/nested/c.ts': 'export {};\n',
      '.dotfile': 'dot\n',
    });

    const first = await walkRepository(dir);
    const second = await walkRepository(dir);

    expect(first.truncated).toBe(false);
    const paths = first.files.map((f) => f.path);
    expect(paths).toEqual(second.files.map((f) => f.path));
    expect(paths).toContain('.dotfile');
    expect(paths).toContain('src/nested/c.ts');
    // Sorting is asserted against an independently sorted copy, not by
    // re-deriving the comparator under test.
    expect(paths).toEqual([...paths].sort((a, b) => a.localeCompare(b)));
  });

  it('stops pulling entries once maxFiles is reached, proven against a synthetic 5000-entry stream', async () => {
    // Regression test for streaming vs. buffer-then-truncate. Uses the
    // `collectTruncated` seam (packages/analyzers/src/file-walk-internal.ts,
    // not part of this package's public surface) to feed `walkRepository`'s
    // truncation logic a cheap in-memory async generator instead of
    // thousands of real files, and counts how many entries were actually
    // pulled from it — proving the walk stops at `maxFiles` rather than
    // draining the whole source, without any real filesystem I/O.
    const totalAvailable = 5000;
    let consumed = 0;
    async function* syntheticEntries(): AsyncGenerator<string> {
      for (let i = 0; i < totalAvailable; i++) {
        consumed++;
        yield `file-${i}.ts`;
      }
    }

    const { matchedEntries, truncated } = await collectTruncated(
      syntheticEntries(),
      () => false,
      3,
    );

    expect(truncated).toBe(true);
    expect(matchedEntries.length).toBe(3);
    expect(consumed).toBe(3);
    expect(consumed).toBeLessThan(totalAvailable);
  });

  it('truncates results on a real, modestly sized filesystem tree (integration)', async () => {
    // Companion to the synthetic test above: a small real fixture (20
    // files) proves the same behavior end-to-end through `walkRepository`
    // and actual filesystem enumeration, without the thousands-of-files
    // fixture that made this test slow on GitHub-hosted Windows runners.
    const tree: Record<string, string> = {};
    for (let dirIndex = 0; dirIndex < 4; dirIndex++) {
      for (let fileIndex = 0; fileIndex < 5; fileIndex++) {
        tree[`src/module-${dirIndex}/file-${fileIndex}.ts`] = '';
      }
    }
    await writeTree(dir, tree);

    const { files, truncated } = await walkRepository(dir, { maxFiles: 3 });

    expect(truncated).toBe(true);
    expect(files.length).toBe(3);
  });
});

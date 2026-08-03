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
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { createTempDir, removeTempDir } from '@recall-ai/test-fixtures';
import { ensureRecallCacheIgnored } from '../gitignore.js';

describe('ensureRecallCacheIgnored', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  it('creates a .gitignore with the cache entry when none exists', async () => {
    const result = await ensureRecallCacheIgnored(dir);
    expect(result.changed).toBe(true);
    const contents = await readFile(join(dir, '.gitignore'), 'utf8');
    expect(contents).toContain('.recall/cache/');
  });

  it('appends the entry to an existing .gitignore', async () => {
    await writeFile(join(dir, '.gitignore'), 'node_modules/\n', 'utf8');
    const result = await ensureRecallCacheIgnored(dir);
    expect(result.changed).toBe(true);
    const contents = await readFile(join(dir, '.gitignore'), 'utf8');
    expect(contents).toContain('node_modules/');
    expect(contents).toContain('.recall/cache/');
  });

  it('is idempotent when the entry already exists', async () => {
    await ensureRecallCacheIgnored(dir);
    const second = await ensureRecallCacheIgnored(dir);
    expect(second.changed).toBe(false);
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FactCollectionSchema } from '@recall-ai/schemas';
import { createTempDir, removeTempDir, writeTree } from '@recall-ai/test-fixtures';
import { detectFrameworkFacts } from '../framework-facts.js';
import type { WalkedFile } from '../file-walk.js';

function file(path: string): WalkedFile {
  return { path, sizeBytes: 0, extension: '' };
}

// No `files` fixture in the config-file-only tests below includes a
// 'package.json' entry, so `detectFrameworkFacts` never attempts to read
// anything under this path — it only needs to exist as a value, not as a
// real directory.
const UNUSED_ROOT = '/unused-root';

describe('detectFrameworkFacts — config file evidence', () => {
  it('detects NestJS from nest-cli.json and cites it as evidence', async () => {
    const facts = await detectFrameworkFacts([file('nest-cli.json')], UNUSED_ROOT);
    expect(facts).toEqual([
      {
        category: 'framework',
        value: 'nestjs',
        evidence: [{ path: 'nest-cli.json', reason: 'nest-cli.json present' }],
      },
    ]);
  });

  it('detects Next.js from next.config.ts', async () => {
    const facts = await detectFrameworkFacts([file('next.config.ts')], UNUSED_ROOT);
    expect(facts).toEqual([
      {
        category: 'framework',
        value: 'nextjs',
        evidence: [{ path: 'next.config.ts', reason: 'next.config.ts present' }],
      },
    ]);
  });

  it('detects Next.js from next.config.js and next.config.mjs', async () => {
    expect(
      (await detectFrameworkFacts([file('next.config.js')], UNUSED_ROOT)).map((f) => f.value),
    ).toEqual(['nextjs']);
    expect(
      (await detectFrameworkFacts([file('next.config.mjs')], UNUSED_ROOT)).map((f) => f.value),
    ).toEqual(['nextjs']);
  });

  it('detects a framework config file at any depth in the tree, not only at the root', async () => {
    const facts = await detectFrameworkFacts([file('apps/web/next.config.ts')], UNUSED_ROOT);
    expect(facts).toEqual([
      {
        category: 'framework',
        value: 'nextjs',
        evidence: [{ path: 'apps/web/next.config.ts', reason: 'next.config.ts present' }],
      },
    ]);
  });

  it('does not match a filename that merely contains a signal as a substring', async () => {
    const facts = await detectFrameworkFacts(
      [file('src/next.config.ts.bak'), file('my-next.config.ts')],
      UNUSED_ROOT,
    );
    expect(facts).toEqual([]);
  });

  it('detects multiple frameworks in a fixed, deterministic order regardless of input order', async () => {
    const facts = await detectFrameworkFacts(
      [file('next.config.ts'), file('nest-cli.json')],
      UNUSED_ROOT,
    );
    expect(facts.map((f) => f.value)).toEqual(['nestjs', 'nextjs']);
  });
});

describe('detectFrameworkFacts — no evidence', () => {
  it('produces no fact, and no error, when a repository has no recognized framework', async () => {
    const facts = await detectFrameworkFacts(
      [file('README.md'), file('src/index.ts')],
      UNUSED_ROOT,
    );
    expect(facts).toEqual([]);
  });
});

describe('detectFrameworkFacts — dependency declaration evidence', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  it('detects a framework from a package.json dependency and cites the declaration', async () => {
    await writeTree(dir, {
      'package.json': JSON.stringify({ dependencies: { express: '^4.0.0' } }),
    });

    const facts = await detectFrameworkFacts([file('package.json')], dir);
    expect(facts).toEqual([
      {
        category: 'framework',
        value: 'express',
        evidence: [{ path: 'package.json', reason: 'dependency "express" declared' }],
      },
    ]);
  });

  it('detects a framework declared in devDependencies', async () => {
    await writeTree(dir, {
      'package.json': JSON.stringify({ devDependencies: { vue: '^3.0.0' } }),
    });

    const facts = await detectFrameworkFacts([file('package.json')], dir);
    expect(facts.map((f) => f.value)).toEqual(['vue']);
  });

  it('detects a package.json at any depth in the tree', async () => {
    await writeTree(dir, {
      'apps/api/package.json': JSON.stringify({ dependencies: { fastify: '^4.0.0' } }),
    });

    const facts = await detectFrameworkFacts([file('apps/api/package.json')], dir);
    expect(facts).toEqual([
      {
        category: 'framework',
        value: 'fastify',
        evidence: [{ path: 'apps/api/package.json', reason: 'dependency "fastify" declared' }],
      },
    ]);
  });

  it('merges config-file and dependency evidence into a single fact for the same framework', async () => {
    await writeTree(dir, {
      'next.config.ts': '',
      'package.json': JSON.stringify({ dependencies: { next: '^15.0.0' } }),
    });

    const facts = await detectFrameworkFacts([file('next.config.ts'), file('package.json')], dir);
    expect(facts).toEqual([
      {
        category: 'framework',
        value: 'nextjs',
        evidence: [
          { path: 'next.config.ts', reason: 'next.config.ts present' },
          { path: 'package.json', reason: 'dependency "next" declared' },
        ],
      },
    ]);
  });

  it('suppresses a redundant React fact when Next.js is already detected', async () => {
    await writeTree(dir, {
      'package.json': JSON.stringify({ dependencies: { next: '^15.0.0', react: '^19.0.0' } }),
    });

    const facts = await detectFrameworkFacts([file('package.json')], dir);
    expect(facts.map((f) => f.value)).toEqual(['nextjs']);
  });

  it('reports React on its own when Next.js is not present', async () => {
    await writeTree(dir, {
      'package.json': JSON.stringify({ dependencies: { react: '^19.0.0' } }),
    });

    const facts = await detectFrameworkFacts([file('package.json')], dir);
    expect(facts.map((f) => f.value)).toEqual(['react']);
  });

  it('produces no fact, and no error, when package.json declares no recognized framework', async () => {
    await writeTree(dir, {
      'package.json': JSON.stringify({ dependencies: { lodash: '^4.0.0' } }),
    });

    const facts = await detectFrameworkFacts([file('package.json')], dir);
    expect(facts).toEqual([]);
  });

  it('produces no fact, and no error, when package.json is malformed', async () => {
    await writeTree(dir, { 'package.json': '{ not valid json' });

    const facts = await detectFrameworkFacts([file('package.json')], dir);
    expect(facts).toEqual([]);
  });

  it('does not read a package.json not present in the walked file list', async () => {
    await writeTree(dir, {
      'package.json': JSON.stringify({ dependencies: { react: '^19.0.0' } }),
    });

    // `files` deliberately omits 'package.json', proving detection is
    // driven only by what the walk already confirmed, not a blind read.
    const facts = await detectFrameworkFacts([file('README.md')], dir);
    expect(facts).toEqual([]);
  });

  it('processes multiple package.json files in deterministic, sorted-path order', async () => {
    await writeTree(dir, {
      'packages/b/package.json': JSON.stringify({ dependencies: { vue: '^3.0.0' } }),
      'packages/a/package.json': JSON.stringify({ dependencies: { express: '^4.0.0' } }),
    });

    const first = await detectFrameworkFacts(
      [file('packages/b/package.json'), file('packages/a/package.json')],
      dir,
    );
    const second = await detectFrameworkFacts(
      [file('packages/a/package.json'), file('packages/b/package.json')],
      dir,
    );
    expect(first).toEqual(second);
    expect(first.map((f) => f.value)).toEqual(['express', 'vue']);
  });

  it('emits Facts that conform to the frozen Fact schema', async () => {
    await writeTree(dir, {
      'nest-cli.json': '',
      'package.json': JSON.stringify({ dependencies: { react: '^19.0.0' } }),
    });

    const facts = await detectFrameworkFacts([file('nest-cli.json'), file('package.json')], dir);
    const result = FactCollectionSchema.safeParse(facts);
    expect(result.success).toBe(true);
    expect(facts.every((f) => f.evidence.length >= 1)).toBe(true);
  });
});

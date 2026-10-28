import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FactCollectionSchema } from '@recall-ai/schemas';
import { createTempDir, removeTempDir, writeTree } from '@recall-ai/test-fixtures';
import { detectDependencyFacts } from '../dependency-facts.js';
import type { WalkedFile } from '../file-walk.js';

function file(path: string): WalkedFile {
  return { path, sizeBytes: 0, extension: '' };
}

describe('detectDependencyFacts', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  it('extracts a dependency and cites the manifest entry', async () => {
    await writeTree(dir, {
      'package.json': JSON.stringify({ dependencies: { react: '^19.0.0' } }),
    });

    const facts = await detectDependencyFacts([file('package.json')], dir);
    expect(facts).toEqual([
      {
        category: 'dependency',
        value: { name: 'react', version: '^19.0.0', scope: 'dependency' },
        evidence: [{ path: 'package.json', reason: 'dependencies.react declared' }],
      },
    ]);
  });

  it('extracts a devDependency with the correct scope', async () => {
    await writeTree(dir, {
      'package.json': JSON.stringify({ devDependencies: { vitest: '^2.0.0' } }),
    });

    const facts = await detectDependencyFacts([file('package.json')], dir);
    expect(facts).toEqual([
      {
        category: 'dependency',
        value: { name: 'vitest', version: '^2.0.0', scope: 'devDependency' },
        evidence: [{ path: 'package.json', reason: 'devDependencies.vitest declared' }],
      },
    ]);
  });

  it('extracts a peerDependency with the correct scope', async () => {
    await writeTree(dir, {
      'package.json': JSON.stringify({ peerDependencies: { react: '^19.0.0' } }),
    });

    const facts = await detectDependencyFacts([file('package.json')], dir);
    expect(facts).toEqual([
      {
        category: 'dependency',
        value: { name: 'react', version: '^19.0.0', scope: 'peerDependency' },
        evidence: [{ path: 'package.json', reason: 'peerDependencies.react declared' }],
      },
    ]);
  });

  it('does not extract optionalDependencies', async () => {
    await writeTree(dir, {
      'package.json': JSON.stringify({ optionalDependencies: { fsevents: '^2.3.0' } }),
    });

    const facts = await detectDependencyFacts([file('package.json')], dir);
    expect(facts).toEqual([]);
  });

  it('extracts multiple dependencies in fixed scope order, then sorted name order', async () => {
    await writeTree(dir, {
      'package.json': JSON.stringify({
        devDependencies: { zod: '^3.0.0', eslint: '^9.0.0' },
        dependencies: { react: '^19.0.0', axios: '^1.0.0' },
      }),
    });

    const facts = await detectDependencyFacts([file('package.json')], dir);
    expect(facts.map((f) => f.value)).toEqual([
      { name: 'axios', version: '^1.0.0', scope: 'dependency' },
      { name: 'react', version: '^19.0.0', scope: 'dependency' },
      { name: 'eslint', version: '^9.0.0', scope: 'devDependency' },
      { name: 'zod', version: '^3.0.0', scope: 'devDependency' },
    ]);
  });

  it('extracts from multiple package.json files in sorted-path order', async () => {
    await writeTree(dir, {
      'package.json': JSON.stringify({ dependencies: { turbo: '^2.0.0' } }),
      'apps/web/package.json': JSON.stringify({ dependencies: { next: '^15.0.0' } }),
      'packages/core/package.json': JSON.stringify({ dependencies: { zod: '^3.0.0' } }),
    });

    const facts = await detectDependencyFacts(
      [file('apps/web/package.json'), file('package.json'), file('packages/core/package.json')],
      dir,
    );
    expect(facts.map((f) => [f.evidence[0]?.path, (f.value as { name: string }).name])).toEqual([
      ['apps/web/package.json', 'next'],
      ['package.json', 'turbo'],
      ['packages/core/package.json', 'zod'],
    ]);
  });

  it('does not read a package.json not present in the walked file list', async () => {
    await writeTree(dir, {
      'package.json': JSON.stringify({ dependencies: { react: '^19.0.0' } }),
    });

    const facts = await detectDependencyFacts([file('README.md')], dir);
    expect(facts).toEqual([]);
  });

  it('produces no facts, and no error, when package.json is malformed', async () => {
    await writeTree(dir, { 'package.json': '{ not valid json' });
    const facts = await detectDependencyFacts([file('package.json')], dir);
    expect(facts).toEqual([]);
  });

  it('produces no facts, and no error, when no package.json exists at all', async () => {
    const facts = await detectDependencyFacts([file('README.md')], dir);
    expect(facts).toEqual([]);
  });

  it('never extracts a dependency from a lockfile alone, with no package.json present', async () => {
    await writeTree(dir, {
      'pnpm-lock.yaml': 'packages:\n  react@19.0.0: {}\n',
    });

    const facts = await detectDependencyFacts([file('pnpm-lock.yaml')], dir);
    expect(facts).toEqual([]);
  });

  it('produces identical output across repeated calls regardless of input file order', async () => {
    await writeTree(dir, {
      'package.json': JSON.stringify({ dependencies: { react: '^19.0.0', axios: '^1.0.0' } }),
      'apps/web/package.json': JSON.stringify({ dependencies: { next: '^15.0.0' } }),
    });

    const first = await detectDependencyFacts(
      [file('package.json'), file('apps/web/package.json')],
      dir,
    );
    const second = await detectDependencyFacts(
      [file('apps/web/package.json'), file('package.json')],
      dir,
    );
    expect(first).toEqual(second);
  });

  it('emits Facts that conform to the frozen Fact schema', async () => {
    await writeTree(dir, {
      'package.json': JSON.stringify({
        dependencies: { react: '^19.0.0' },
        devDependencies: { vitest: '^2.0.0' },
      }),
    });

    const facts = await detectDependencyFacts([file('package.json')], dir);
    const result = FactCollectionSchema.safeParse(facts);
    expect(result.success).toBe(true);
    expect(facts.every((f) => f.evidence.length >= 1)).toBe(true);
    expect(facts.length).toBe(2);
  });
});

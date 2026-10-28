import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FactCollectionSchema } from '@recall-ai/schemas';
import { createTempDir, removeTempDir, writeTree } from '@recall-ai/test-fixtures';
import { detectWorkspaceLayoutFacts } from '../workspace-layout-facts.js';
import type { WalkedFile } from '../file-walk.js';

function file(path: string): WalkedFile {
  return { path, sizeBytes: 0, extension: '' };
}

describe('detectWorkspaceLayoutFacts', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  it('produces no fact, and no error, when there is no root package.json', async () => {
    const facts = await detectWorkspaceLayoutFacts([file('README.md')], dir);
    expect(facts).toEqual([]);
  });

  it('produces no fact, and no error, when the root package.json is malformed', async () => {
    await writeTree(dir, { 'package.json': '{ not valid json' });
    const facts = await detectWorkspaceLayoutFacts([file('package.json')], dir);
    expect(facts).toEqual([]);
  });

  it('reports a single-entry workspace list for a package.json with no workspaces field', async () => {
    await writeTree(dir, { 'package.json': JSON.stringify({ name: 'my-app' }) });

    const facts = await detectWorkspaceLayoutFacts([file('package.json')], dir);
    expect(facts).toEqual([
      {
        category: 'workspace-layout',
        value: ['.'],
        evidence: [
          { path: 'package.json', reason: 'package.json present, declares no "workspaces" field' },
        ],
      },
    ]);
  });

  it('detects a monorepo from an array-form "workspaces" field and enumerates members', async () => {
    await writeTree(dir, {
      'package.json': JSON.stringify({ workspaces: ['apps/*', 'packages/*'] }),
      'apps/web/package.json': JSON.stringify({ name: 'web' }),
      'packages/core/package.json': JSON.stringify({ name: 'core' }),
    });

    const facts = await detectWorkspaceLayoutFacts(
      [file('package.json'), file('apps/web/package.json'), file('packages/core/package.json')],
      dir,
    );
    expect(facts).toEqual([
      {
        category: 'workspace-layout',
        value: ['.', 'apps/web', 'packages/core'],
        evidence: [
          { path: 'package.json', reason: '"workspaces" field declared' },
          { path: 'apps/web/package.json', reason: 'workspace member package.json present' },
          { path: 'packages/core/package.json', reason: 'workspace member package.json present' },
        ],
      },
    ]);
  });

  it('detects a monorepo from an object-form "workspaces" field', async () => {
    await writeTree(dir, {
      'package.json': JSON.stringify({ workspaces: { packages: ['apps/*'] } }),
      'apps/web/package.json': JSON.stringify({ name: 'web' }),
    });

    const facts = await detectWorkspaceLayoutFacts(
      [file('package.json'), file('apps/web/package.json')],
      dir,
    );
    expect(facts.map((f) => f.value)).toEqual([['.', 'apps/web']]);
  });

  it('detects a monorepo from pnpm-workspace.yaml alone, with no "workspaces" field', async () => {
    await writeTree(dir, {
      'package.json': JSON.stringify({ name: 'root' }),
      'pnpm-workspace.yaml': "packages:\n  - 'apps/*'\n",
      'apps/web/package.json': JSON.stringify({ name: 'web' }),
    });

    const facts = await detectWorkspaceLayoutFacts(
      [file('package.json'), file('pnpm-workspace.yaml'), file('apps/web/package.json')],
      dir,
    );
    expect(facts).toEqual([
      {
        category: 'workspace-layout',
        value: ['.', 'apps/web'],
        evidence: [
          { path: 'pnpm-workspace.yaml', reason: 'pnpm-workspace.yaml present' },
          { path: 'apps/web/package.json', reason: 'workspace member package.json present' },
        ],
      },
    ]);
  });

  it('cites both signals as evidence when the workspaces field and pnpm-workspace.yaml are both present', async () => {
    await writeTree(dir, {
      'package.json': JSON.stringify({ workspaces: ['apps/*'] }),
      'pnpm-workspace.yaml': "packages:\n  - 'apps/*'\n",
      'apps/web/package.json': JSON.stringify({ name: 'web' }),
    });

    const facts = await detectWorkspaceLayoutFacts(
      [file('package.json'), file('pnpm-workspace.yaml'), file('apps/web/package.json')],
      dir,
    );
    expect(facts[0]?.evidence).toEqual([
      { path: 'package.json', reason: '"workspaces" field declared' },
      { path: 'pnpm-workspace.yaml', reason: 'pnpm-workspace.yaml present' },
      { path: 'apps/web/package.json', reason: 'workspace member package.json present' },
    ]);
  });

  it('does not require a package.json not present in the walked file list to detect a member', async () => {
    await writeTree(dir, {
      'package.json': JSON.stringify({ workspaces: ['apps/*'] }),
      'apps/web/package.json': JSON.stringify({ name: 'web' }),
    });

    // 'apps/web/package.json' is deliberately omitted from `files`, proving
    // member enumeration is driven only by what the walk already confirmed.
    const facts = await detectWorkspaceLayoutFacts([file('package.json')], dir);
    expect(facts.map((f) => f.value)).toEqual([['.']]);
  });

  it('produces member paths in deterministic, sorted order regardless of input order', async () => {
    await writeTree(dir, {
      'package.json': JSON.stringify({ workspaces: ['apps/*', 'packages/*'] }),
      'apps/b/package.json': JSON.stringify({ name: 'b' }),
      'apps/a/package.json': JSON.stringify({ name: 'a' }),
    });

    const first = await detectWorkspaceLayoutFacts(
      [file('package.json'), file('apps/b/package.json'), file('apps/a/package.json')],
      dir,
    );
    const second = await detectWorkspaceLayoutFacts(
      [file('apps/a/package.json'), file('apps/b/package.json'), file('package.json')],
      dir,
    );
    expect(first).toEqual(second);
    expect(first.map((f) => f.value)).toEqual([['.', 'apps/a', 'apps/b']]);
  });

  it('emits Facts that conform to the frozen Fact schema', async () => {
    await writeTree(dir, {
      'package.json': JSON.stringify({ workspaces: ['apps/*'] }),
      'apps/web/package.json': JSON.stringify({ name: 'web' }),
    });

    const facts = await detectWorkspaceLayoutFacts(
      [file('package.json'), file('apps/web/package.json')],
      dir,
    );
    const result = FactCollectionSchema.safeParse(facts);
    expect(result.success).toBe(true);
    expect(facts.every((f) => f.evidence.length >= 1)).toBe(true);
  });
});

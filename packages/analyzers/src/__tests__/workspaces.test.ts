import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildPnpmMonorepoFixture, createTempDir, removeTempDir } from '@recall-ai/test-fixtures';
import { detectEcosystem } from '../package-manager.js';
import { discoverWorkspaces } from '../workspaces.js';

describe('discoverWorkspaces', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempDir();
    await buildPnpmMonorepoFixture(dir);
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  it('discovers all workspace packages with the correct kind', async () => {
    const ecosystem = await detectEcosystem(dir);
    const workspaces = await discoverWorkspaces(dir, ecosystem.workspaceGlobs);
    const byName = new Map(workspaces.map((w) => [w.info.name, w]));

    expect(byName.get('@fixture/api')?.info.kind).toBe('app');
    expect(byName.get('@fixture/shared')?.info.kind).toBe('package');
    expect(byName.get('@fixture/ui')?.info.kind).toBe('package');
  });

  it('infers dependsOn from workspace: dependency declarations', async () => {
    const ecosystem = await detectEcosystem(dir);
    const workspaces = await discoverWorkspaces(dir, ecosystem.workspaceGlobs);
    const byName = new Map(workspaces.map((w) => [w.info.name, w]));

    expect(byName.get('@fixture/api')?.info.dependsOn).toEqual(['@fixture/shared']);
    expect(byName.get('@fixture/ui')?.info.dependsOn).toEqual(['@fixture/shared']);
    expect(byName.get('@fixture/shared')?.info.dependsOn).toEqual([]);
  });

  it('returns a single root workspace when there are no workspace globs', async () => {
    const other = await createTempDir();
    try {
      const { writeTree } = await import('@recall-ai/test-fixtures');
      await writeTree(other, {
        'package.json': JSON.stringify({ name: 'solo', version: '1.0.0' }),
      });
      const workspaces = await discoverWorkspaces(other, []);
      expect(workspaces).toHaveLength(1);
      expect(workspaces[0]?.info.kind).toBe('root');
      expect(workspaces[0]?.info.name).toBe('solo');
    } finally {
      await removeTempDir(other);
    }
  });
});

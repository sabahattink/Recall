import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildNestJsFixture,
  buildNextJsFixture,
  buildPnpmMonorepoFixture,
  buildSimpleNodeFixture,
  createTempDir,
  removeTempDir,
} from '@recall-ai/test-fixtures';
import { RepositorySnapshotSchema } from '@recall-ai/schemas';
import { scanRepository } from '../scanner.js';

describe('scanRepository', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  it('produces a schema-valid snapshot for a simple Node.js project', async () => {
    await buildSimpleNodeFixture(dir);
    const { snapshot, truncated } = await scanRepository(dir);
    expect(truncated).toBe(false);
    const result = RepositorySnapshotSchema.safeParse(snapshot);
    expect(result.success).toBe(true);
    expect(snapshot.ecosystem.isMonorepo).toBe(false);
    expect(snapshot.frameworks.some((f) => f.name === 'express')).toBe(true);
    expect(snapshot.testing.testFiles.length).toBeGreaterThan(0);
  });

  it('detects NestJS and its conventional entry point', async () => {
    await buildNestJsFixture(dir);
    const { snapshot } = await scanRepository(dir);
    expect(snapshot.frameworks.some((f) => f.name === 'nestjs')).toBe(true);
    expect(
      snapshot.entryPoints.some(
        (e) => e.kind === 'framework-convention' && e.path.endsWith('src/main.ts'),
      ),
    ).toBe(true);
  });

  it('detects Next.js and its conventional entry point', async () => {
    await buildNextJsFixture(dir);
    const { snapshot } = await scanRepository(dir);
    expect(snapshot.frameworks.some((f) => f.name === 'nextjs')).toBe(true);
    expect(
      snapshot.entryPoints.some(
        (e) => e.kind === 'framework-convention' && e.path.endsWith('src/app/layout.tsx'),
      ),
    ).toBe(true);
  });

  it('discovers workspaces and internal edges for a pnpm monorepo', async () => {
    await buildPnpmMonorepoFixture(dir);
    const { snapshot } = await scanRepository(dir);
    expect(snapshot.ecosystem.isMonorepo).toBe(true);
    expect(snapshot.workspaces.map((w) => w.name).sort()).toEqual([
      '@fixture/api',
      '@fixture/shared',
      '@fixture/ui',
    ]);
    const workspaceEdges = snapshot.internalEdges.filter((e) => e.kind === 'workspace');
    expect(workspaceEdges).toContainEqual(
      expect.objectContaining({ from: 'apps/api', to: 'packages/shared' }),
    );
    const importEdges = snapshot.internalEdges.filter((e) => e.kind === 'import');
    expect(
      importEdges.some((e) => e.from === 'apps/api/src/index.ts' && e.to === 'packages/shared'),
    ).toBe(true);
  });

  it('is deterministic across repeated scans of the same tree', async () => {
    await buildPnpmMonorepoFixture(dir);
    const first = await scanRepository(dir);
    const second = await scanRepository(dir);
    const strip = (s: typeof first.snapshot) => ({ ...s, generatedAt: '' });
    expect(strip(first.snapshot)).toEqual(strip(second.snapshot));
  });
});

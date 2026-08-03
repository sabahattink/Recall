import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTempDir, removeTempDir, writeTree } from '@recall-ai/test-fixtures';
import { detectEcosystem } from '../package-manager.js';

describe('detectEcosystem', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  it('detects pnpm from a lockfile and workspace globs from pnpm-workspace.yaml', async () => {
    await writeTree(dir, {
      'package.json': JSON.stringify({ name: 'root', private: true }),
      'pnpm-workspace.yaml': 'packages:\n  - "apps/*"\n  - "packages/*"\n',
    });
    await writeFile(join(dir, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');

    const ecosystem = await detectEcosystem(dir);
    expect(ecosystem.packageManager).toBe('pnpm');
    expect(ecosystem.isMonorepo).toBe(true);
    expect(ecosystem.workspaceGlobs).toEqual(['apps/*', 'packages/*']);
    expect(ecosystem.hasLockfile).toBe(true);
    expect(ecosystem.lockfilePath).toBe('pnpm-lock.yaml');
  });

  it('detects npm from package-lock.json', async () => {
    await writeTree(dir, { 'package.json': JSON.stringify({ name: 'root' }) });
    await writeFile(join(dir, 'package-lock.json'), '{}');

    const ecosystem = await detectEcosystem(dir);
    expect(ecosystem.packageManager).toBe('npm');
    expect(ecosystem.isMonorepo).toBe(false);
  });

  it('detects yarn from yarn.lock', async () => {
    await writeTree(dir, { 'package.json': JSON.stringify({ name: 'root' }) });
    await writeFile(join(dir, 'yarn.lock'), '# yarn lockfile v1\n');

    const ecosystem = await detectEcosystem(dir);
    expect(ecosystem.packageManager).toBe('yarn');
  });

  it('prefers the declared packageManager field over lockfile inference', async () => {
    await writeTree(dir, {
      'package.json': JSON.stringify({ name: 'root', packageManager: 'pnpm@9.12.0' }),
    });
    await writeFile(join(dir, 'yarn.lock'), '# yarn lockfile v1\n');

    const ecosystem = await detectEcosystem(dir);
    expect(ecosystem.packageManager).toBe('pnpm');
    expect(ecosystem.packageManagerVersion).toBe('9.12.0');
  });

  it('reports unknown when no lockfile or declaration exists', async () => {
    await writeTree(dir, { 'package.json': JSON.stringify({ name: 'root' }) });
    const ecosystem = await detectEcosystem(dir);
    expect(ecosystem.packageManager).toBe('unknown');
    expect(ecosystem.hasLockfile).toBe(false);
  });

  it('detects TypeScript from tsconfig.json presence', async () => {
    await writeTree(dir, {
      'package.json': JSON.stringify({ name: 'root' }),
      'tsconfig.json': '{}',
    });
    const ecosystem = await detectEcosystem(dir);
    expect(ecosystem.hasTypescript).toBe(true);
  });
});

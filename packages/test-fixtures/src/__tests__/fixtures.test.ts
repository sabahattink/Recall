import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildNestJsFixture,
  buildNextJsFixture,
  buildPnpmMonorepoFixture,
  buildSimpleNodeFixture,
  createTempDir,
  removeTempDir,
} from '../index.js';

describe('fixture builders', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  it('writes a simple Node.js project', async () => {
    await buildSimpleNodeFixture(dir);
    await expect(access(join(dir, 'package.json'))).resolves.toBeUndefined();
    await expect(access(join(dir, 'src/index.js'))).resolves.toBeUndefined();
  });

  it('writes a NestJS project', async () => {
    await buildNestJsFixture(dir);
    await expect(access(join(dir, 'src/main.ts'))).resolves.toBeUndefined();
    await expect(access(join(dir, 'src/users/users.module.ts'))).resolves.toBeUndefined();
  });

  it('writes a Next.js project', async () => {
    await buildNextJsFixture(dir);
    await expect(access(join(dir, 'src/app/page.tsx'))).resolves.toBeUndefined();
    await expect(access(join(dir, 'next.config.js'))).resolves.toBeUndefined();
  });

  it('writes a pnpm monorepo project', async () => {
    await buildPnpmMonorepoFixture(dir);
    await expect(access(join(dir, 'pnpm-workspace.yaml'))).resolves.toBeUndefined();
    await expect(access(join(dir, 'apps/api/package.json'))).resolves.toBeUndefined();
    await expect(access(join(dir, 'packages/shared/package.json'))).resolves.toBeUndefined();
  });
});

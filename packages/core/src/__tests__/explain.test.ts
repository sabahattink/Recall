import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildNestJsFixture,
  commitAll,
  createTempDir,
  initGitRepo,
  removeTempDir,
} from '@recall-ai/test-fixtures';
import { runInit } from '../use-cases/init.js';
import { runExplain } from '../use-cases/explain.js';
import { InvalidUsageError } from '../errors.js';

describe('runExplain', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempDir();
    await buildNestJsFixture(dir);
    await initGitRepo(dir);
    await commitAll(dir, 'chore: initial commit');
    await runInit({ path: dir, toolVersion: '0.1.0' });
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  it('explains a NestJS controller with high confidence', async () => {
    const result = await runExplain(dir, 'src/users/users.controller.ts');
    expect(result.type).toBe('file');
    expect(result.confidence).toBe('high');
    expect(result.likelyResponsibility).toMatch(/HTTP routing/i);
    expect(result.relatedTests.length === 0 || result.relatedTests.length >= 0).toBe(true);
  });

  it('explains a NestJS service and reports incoming dependencies', async () => {
    const result = await runExplain(dir, 'src/users/users.service.ts');
    expect(result.confidence).toBe('high');
    expect(result.likelyResponsibility).toMatch(/business logic/i);
  });

  it('explains a directory by aggregating its files', async () => {
    const result = await runExplain(dir, 'src/users');
    expect(result.type).toBe('directory');
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it('throws InvalidUsageError for a path that does not exist', async () => {
    await expect(runExplain(dir, 'src/does-not-exist.ts')).rejects.toThrow(InvalidUsageError);
  });
});

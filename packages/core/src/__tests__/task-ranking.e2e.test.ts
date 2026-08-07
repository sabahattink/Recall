import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildTaskRankingFixture,
  createTempDir,
  integrationHookTimeout,
  removeTempDir,
} from '@recall-ai/test-fixtures';
import { runInit } from '../use-cases/init.js';
import { runContext } from '../use-cases/context.js';

/**
 * End-to-end regression coverage for task-focused ranking, against a real
 * scanned repository (packages/test-fixtures/src/fixtures/task-ranking.ts)
 * rather than a hand-built snapshot — this is what actually exercises the
 * full init → scan → rank pipeline the way `recall context --task` really
 * runs. Assertions deliberately check "required files are in the top N" and
 * "irrelevant/generated files are absent", not one fragile total order.
 */
describe('task-focused ranking (regression fixture, end-to-end)', () => {
  let dir: string;

  // Writes ~35 fixture files, then `runInit` scans them and probes Git via
  // several `git` subprocess spawns (repo detection + metadata, all of which
  // no-op/fail cleanly since this temp dir isn't a Git repo, but each spawn
  // still pays full process-creation cost). This hook has measured over
  // Vitest's default 10000ms hookTimeout on Windows CI, where process-spawn
  // and AV-scan overhead run far higher than on Linux/macOS or a local dev
  // machine. The `it()` bodies below only read the already-computed snapshot
  // in memory, so they don't need the same allowance.
  beforeEach(async () => {
    dir = await createTempDir();
    await buildTaskRankingFixture(dir);
    await runInit({ path: dir, toolVersion: '0.1.0' });
  }, integrationHookTimeout);

  afterEach(async () => {
    await removeTempDir(dir);
  });

  const TOP_N = 10;

  it('A: "Improve task-focused context ranking" surfaces the context command, use case, ranker, and their tests', async () => {
    const result = await runContext({
      path: dir,
      stdout: true,
      task: 'Improve task-focused context ranking',
    });
    const topPaths = result.rankedFiles.slice(0, TOP_N).map((f) => f.path);

    for (const required of [
      'src/cli/commands/context-command.ts',
      'src/core/context-use-case.ts',
      'src/core/context-ranker.ts',
    ]) {
      expect(topPaths, `expected ${required} in top ${TOP_N}`).toContain(required);
    }
    // At least one associated test file must also surface.
    expect(
      topPaths.some(
        (p) =>
          p.includes('context-command.test.ts') ||
          p.includes('context-use-case.test.ts') ||
          p.includes('context-ranker.test.ts'),
      ),
    ).toBe(true);

    for (const irrelevant of [
      'src/billing/invoice-generator.ts',
      'src/billing/payment-processor.ts',
      'src/auth/password-reset.controller.ts',
      'fixtures/sample-project/index.ts',
    ]) {
      expect(topPaths, `did not expect ${irrelevant} in top ${TOP_N}`).not.toContain(irrelevant);
    }
  });

  it('B: "Fix password reset controller" surfaces the controller, service, and their tests', async () => {
    const result = await runContext({
      path: dir,
      stdout: true,
      task: 'Fix password reset controller',
    });
    const topPaths = result.rankedFiles.slice(0, TOP_N).map((f) => f.path);

    for (const required of [
      'src/auth/password-reset.controller.ts',
      'src/auth/password-reset.service.ts',
    ]) {
      expect(topPaths, `expected ${required} in top ${TOP_N}`).toContain(required);
    }
    expect(topPaths.some((p) => p.includes('password-reset.controller.test.ts'))).toBe(true);

    for (const irrelevant of [
      'src/billing/invoice-generator.ts',
      'src/core/context-ranker.ts',
      'src/misc/logger.ts',
      'fixtures/sample-project/index.ts',
    ]) {
      expect(topPaths, `did not expect ${irrelevant} in top ${TOP_N}`).not.toContain(irrelevant);
    }
  });

  it('C: "Update CI packaging" surfaces the workflow, packaging script, packaging test, and package.json', async () => {
    const result = await runContext({
      path: dir,
      stdout: true,
      task: 'Update CI packaging',
    });
    const topPaths = result.rankedFiles.slice(0, TOP_N).map((f) => f.path);

    for (const required of [
      '.github/workflows/ci.yml',
      'scripts/package-release.mjs',
      'scripts/__tests__/package-release.test.ts',
      'package.json',
    ]) {
      expect(topPaths, `expected ${required} in top ${TOP_N}`).toContain(required);
    }

    for (const irrelevant of [
      'src/billing/invoice-generator.ts',
      'src/auth/password-reset.controller.ts',
      'fixtures/sample-project/index.ts',
    ]) {
      expect(topPaths, `did not expect ${irrelevant} in top ${TOP_N}`).not.toContain(irrelevant);
    }
  });

  it('Sprint 2.1 regression: "Fix Windows npm packaging shebang" is not crowded out by generic package.json/config matches', async () => {
    const result = await runContext({
      path: dir,
      stdout: true,
      task: 'Fix Windows npm packaging shebang',
    });
    const topPaths = result.rankedFiles.slice(0, TOP_N).map((f) => f.path);

    for (const required of [
      'apps/cli/scripts/bundle.mjs',
      'apps/cli/scripts/bundle-internal.mjs',
      'apps/cli/scripts/verify-package.mjs',
    ]) {
      expect(topPaths, `expected ${required} in top ${TOP_N}`).toContain(required);
    }
    expect(
      topPaths.some(
        (p) =>
          p === 'apps/cli/src/__tests__/packaging.test.ts' ||
          p.endsWith('bundle-internal.test.mjs'),
      ),
      'expected a packaging/bundle test file in the top N',
    ).toBe(true);

    const packageJsonCount = topPaths.filter((p) => p.endsWith('package.json')).length;
    expect(
      packageJsonCount,
      'unrelated workspace package.json files must not dominate top N',
    ).toBeLessThanOrEqual(2);

    const packageManagerScore =
      result.rankedFiles.find((f) => f.path === 'apps/cli/scripts/bundle-internal.mjs')?.score ?? 0;
    const otherWorkspaceConfigScores = result.rankedFiles
      .filter(
        (f) => f.path === 'packages/alpha/package.json' || f.path === 'packages/beta/package.json',
      )
      .map((f) => f.score);
    for (const score of otherWorkspaceConfigScores) {
      expect(
        score,
        'an unrelated workspace config file must not outrank the true bundler seed',
      ).toBeLessThan(packageManagerScore);
    }
  });

  it('D: "Upgrade zod dependency" still ranks package.json and the lockfile highly despite generic-term protection', async () => {
    const result = await runContext({
      path: dir,
      stdout: true,
      task: 'Upgrade zod dependency',
    });
    const topPaths = result.rankedFiles.slice(0, TOP_N).map((f) => f.path);
    expect(topPaths).toContain('package.json');
    expect(topPaths).toContain('package-lock.json');
  });

  it('E: "Update Windows CI Node version" ranks the workflow above unrelated source files', async () => {
    const result = await runContext({
      path: dir,
      stdout: true,
      task: 'Update Windows CI Node version',
    });
    const byPath = new Map(result.rankedFiles.map((f) => [f.path, f.score]));
    const workflowScore = byPath.get('.github/workflows/ci.yml') ?? 0;
    expect(workflowScore).toBeGreaterThan(0);
    for (const unrelated of ['src/billing/invoice-generator.ts', 'src/misc/logger.ts']) {
      expect(workflowScore).toBeGreaterThan(byPath.get(unrelated) ?? 0);
    }
  });

  it('never ranks a generated/dist file for any task', async () => {
    const result = await runContext({ path: dir, stdout: true, task: 'improve context ranking' });
    expect(result.rankedFiles.some((f) => f.path.startsWith('dist/'))).toBe(false);
  });

  it('produces identical ranked output across repeated runs', async () => {
    const first = await runContext({
      path: dir,
      stdout: true,
      task: 'Fix password reset controller',
    });
    const second = await runContext({
      path: dir,
      stdout: true,
      task: 'Fix password reset controller',
    });
    expect(first.rankedFiles).toEqual(second.rankedFiles);
  });
});

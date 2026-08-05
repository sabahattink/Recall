import { describe, expect, it } from 'vitest';
import { RANKING_WEIGHTS, rankFilesForTask, tokenizeTask } from '../task-ranking.js';
import { makeFile, makeSnapshot } from './test-helpers.js';

describe('tokenizeTask', () => {
  it('lowercases and removes punctuation', () => {
    expect(tokenizeTask('Fix Password-Reset!')).toEqual(['password', 'reset']);
  });

  it('splits camelCase and PascalCase', () => {
    expect(tokenizeTask('Fix passwordResetController')).toEqual([
      'controller',
      'password',
      'reset',
    ]);
  });

  it('splits kebab-case and snake_case', () => {
    expect(tokenizeTask('fix password-reset_flow')).toEqual(['flow', 'password', 'reset']);
  });

  it('removes stop words', () => {
    expect(tokenizeTask('Add the new controller to the service')).toEqual([
      'controller',
      'new',
      'service',
    ]);
  });

  it('preserves technical terms', () => {
    const tokens = tokenizeTask(
      'context ranking auth password reset prisma queue redis controller service',
    );
    for (const term of [
      'context',
      'ranking',
      'auth',
      'password',
      'reset',
      'prisma',
      'queue',
      'redis',
      'controller',
      'service',
    ]) {
      expect(tokens).toContain(term);
    }
  });

  it('adds a safe additive singular form without destroying the plural', () => {
    const tokens = tokenizeTask('Update the controllers');
    expect(tokens).toContain('controllers');
    expect(tokens).toContain('controller');
  });

  it('does not corrupt words a naive plural strip would break', () => {
    const tokens = tokenizeTask('Check the status');
    expect(tokens).toContain('status');
    expect(tokens).not.toContain('statu');
  });

  it('additively relates a gerund to its base form ("packaging" <-> "package")', () => {
    const tokens = tokenizeTask('Update CI packaging');
    expect(tokens).toContain('packaging');
    expect(tokens).toContain('package');
  });

  it('additively relates a gerund with no dropped-e base form ("testing" <-> "test")', () => {
    const tokens = tokenizeTask('Improve testing coverage');
    expect(tokens).toContain('testing');
    expect(tokens).toContain('test');
  });

  it('is deterministic and sorted', () => {
    const first = tokenizeTask('Improve task-focused context ranking');
    const second = tokenizeTask('Improve task-focused context ranking');
    expect(first).toEqual(second);
    expect(first).toEqual([...first].sort());
  });
});

describe('rankFilesForTask: penalties and exclusions', () => {
  it('excludes generated files entirely', async () => {
    const snapshot = makeSnapshot({
      files: [makeFile({ path: 'apps/cli/dist/context.js', kind: 'generated' })],
    });
    const result = await rankFilesForTask({ task: 'context', snapshot });
    expect(result.files).toEqual([]);
  });

  it('excludes node_modules and .recall paths even if somehow present in files', async () => {
    const snapshot = makeSnapshot({
      files: [
        makeFile({ path: 'node_modules/context-pkg/index.js', kind: 'source' }),
        makeFile({ path: '.recall/snapshots/context.json', kind: 'other', extension: '.json' }),
      ],
    });
    const result = await rankFilesForTask({ task: 'context', snapshot });
    expect(result.files).toEqual([]);
  });

  it('excludes binary and minified files', async () => {
    const snapshot = makeSnapshot({
      files: [
        makeFile({ path: 'assets/context.png', kind: 'other', extension: '.png' }),
        makeFile({ path: 'dist/context.min.js', kind: 'source', extension: '.js' }),
      ],
    });
    const result = await rankFilesForTask({ task: 'context', snapshot });
    expect(result.files).toEqual([]);
  });

  it('excludes fixtures unless the task mentions fixtures/tests', async () => {
    const snapshot = makeSnapshot({
      files: [makeFile({ path: 'packages/test-fixtures/fixtures/nestjs/context.ts' })],
    });
    const excluded = await rankFilesForTask({ task: 'improve context ranking', snapshot });
    expect(excluded.files).toEqual([]);

    const included = await rankFilesForTask({
      task: 'improve context ranking fixtures',
      snapshot,
    });
    expect(included.files.map((f) => f.path)).toContain(
      'packages/test-fixtures/fixtures/nestjs/context.ts',
    );
  });

  it('excludes lockfiles unless the task is dependency-related', async () => {
    const snapshot = makeSnapshot({
      files: [makeFile({ path: 'pnpm-lock.yaml', kind: 'other', extension: '.yaml' })],
    });
    const excluded = await rankFilesForTask({ task: 'improve password reset flow', snapshot });
    expect(excluded.files).toEqual([]);

    const included = await rankFilesForTask({ task: 'upgrade a dependency version', snapshot });
    expect(included.files.map((f) => f.path)).toContain('pnpm-lock.yaml');
  });
});

describe('rankFilesForTask: lexical signals', () => {
  it('scores an exact filename match higher than a path-only match', async () => {
    const snapshot = makeSnapshot({
      files: [
        makeFile({ path: 'packages/memory/src/context.ts' }),
        makeFile({ path: 'packages/context-helpers/src/other.ts' }),
      ],
    });
    const result = await rankFilesForTask({ task: 'improve context', snapshot });
    const byPath = new Map(result.files.map((f) => [f.path, f.score]));
    expect(byPath.get('packages/memory/src/context.ts')).toBeGreaterThan(
      byPath.get('packages/context-helpers/src/other.ts') ?? 0,
    );
  });

  it('boosts a workspace whose name matches a task term', async () => {
    const snapshot = makeSnapshot({
      workspaces: [
        {
          name: 'memory',
          path: 'packages/memory',
          kind: 'package',
          version: null,
          private: true,
          dependsOn: [],
          main: null,
          scripts: {},
        },
      ],
      files: [
        makeFile({ path: 'packages/memory/src/unrelated-name.ts', workspace: 'packages/memory' }),
      ],
    });
    const result = await rankFilesForTask({ task: 'improve memory handling', snapshot });
    expect(result.files.map((f) => f.path)).toContain('packages/memory/src/unrelated-name.ts');
  });

  it('scores exported symbols matching a task term', async () => {
    const snapshot = makeSnapshot({
      files: [
        makeFile({
          path: 'apps/cli/scripts/bundle-internal.mjs',
          extension: '.mjs',
          exportedSymbols: ['CANONICAL_SHEBANG', 'normalizeShebang'],
        }),
      ],
    });
    const result = await rankFilesForTask({ task: 'fix windows npm packaging shebang', snapshot });
    expect(result.files.map((f) => f.path)).toContain('apps/cli/scripts/bundle-internal.mjs');
    const reasons = result.files[0]?.reasons.map((r) => r.kind) ?? [];
    expect(reasons).toContain('symbol-term');
  });

  it('only scores config files when the task implies tooling/build/CI relevance', async () => {
    const snapshot = makeSnapshot({
      files: [makeFile({ path: 'vitest.config.ts', kind: 'config' })],
    });
    const excluded = await rankFilesForTask({ task: 'improve password reset', snapshot });
    expect(excluded.files).toEqual([]);

    const included = await rankFilesForTask({ task: 'update CI packaging', snapshot });
    expect(included.files.map((f) => f.path)).toContain('vitest.config.ts');
  });

  it('matches a "package" filename via the "packaging" gerund relation', async () => {
    const snapshot = makeSnapshot({
      files: [makeFile({ path: 'scripts/package-release.mjs', extension: '.mjs' })],
    });
    const result = await rankFilesForTask({ task: 'update CI packaging', snapshot });
    expect(result.files.map((f) => f.path)).toContain('scripts/package-release.mjs');
  });
});

describe('rankFilesForTask: import graph and counterparts', () => {
  it('boosts a direct import neighbor of a seed file', async () => {
    // The neighbor's own name ("runner-impl") deliberately does not
    // lexically match the task, so any score it gets can only have come
    // from the import-graph expansion, not independently from Stage 1.
    const snapshot = makeSnapshot({
      files: [
        makeFile({ path: 'apps/cli/src/commands/context.ts' }),
        makeFile({ path: 'packages/core/src/use-cases/runner-impl.ts' }),
      ],
      internalEdges: [
        {
          from: 'apps/cli/src/commands/context.ts',
          to: 'packages/core/src/use-cases/runner-impl.ts',
          kind: 'import',
          dependencyType: 'runtime',
          evidence: [],
        },
      ],
    });
    const result = await rankFilesForTask({ task: 'improve context command', snapshot });
    const reasons = result.files.find(
      (f) => f.path === 'packages/core/src/use-cases/runner-impl.ts',
    )?.reasons;
    expect(reasons?.some((r) => r.kind === 'import-neighbor')).toBe(true);
  });

  it('boosts a reverse import neighbor (a file that imports the seed)', async () => {
    const snapshot = makeSnapshot({
      files: [
        makeFile({ path: 'apps/cli/src/commands/context.ts' }),
        makeFile({ path: 'apps/cli/src/cli.ts' }),
      ],
      internalEdges: [
        {
          from: 'apps/cli/src/cli.ts',
          to: 'apps/cli/src/commands/context.ts',
          kind: 'import',
          dependencyType: 'runtime',
          evidence: [],
        },
      ],
    });
    const result = await rankFilesForTask({ task: 'improve context command', snapshot });
    const reasons = result.files.find((f) => f.path === 'apps/cli/src/cli.ts')?.reasons;
    expect(reasons?.some((r) => r.kind === 'reverse-import-neighbor')).toBe(true);
  });

  it('bounds graph traversal so an unrelated distant file is not pulled in via a long chain', async () => {
    // A -> B -> C -> D -> E: only a bounded neighborhood around the A seed
    // should be reachable, not the entire chain.
    const chain = ['a-context.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'];
    const files = chain.map((name) => makeFile({ path: `src/${name}` }));
    const internalEdges = chain.slice(0, -1).map((from, i) => ({
      from: `src/${from}`,
      to: `src/${chain[i + 1]}`,
      kind: 'import' as const,
      dependencyType: 'runtime' as const,
      evidence: [],
    }));
    const snapshot = makeSnapshot({ files, internalEdges });
    const result = await rankFilesForTask({ task: 'improve context', snapshot });
    const paths = result.files.map((f) => f.path);
    expect(paths).toContain('src/a-context.ts');
    expect(paths).toContain('src/b.ts');
    expect(paths).toContain('src/c.ts');
    // Depth 3+ from the only seed must not appear.
    expect(paths).not.toContain('src/d.ts');
    expect(paths).not.toContain('src/e.ts');
  });

  it('boosts the test counterpart of a highly-ranked production file', async () => {
    const snapshot = makeSnapshot({
      files: [
        makeFile({ path: 'packages/memory/src/context.ts' }),
        makeFile({ path: 'packages/memory/src/__tests__/context.test.ts', kind: 'test' }),
      ],
    });
    const result = await rankFilesForTask({ task: 'improve context', snapshot });
    const testFile = result.files.find(
      (f) => f.path === 'packages/memory/src/__tests__/context.test.ts',
    );
    expect(testFile).toBeDefined();
    expect(testFile?.reasons.some((r) => r.kind === 'test-counterpart')).toBe(true);
  });

  it('boosts the production counterpart of a task-matching test file', async () => {
    const snapshot = makeSnapshot({
      files: [
        makeFile({ path: 'src/unrelated.ts' }),
        makeFile({ path: 'src/__tests__/unrelated.test.ts', kind: 'test' }),
      ],
    });
    // The task only lexically matches the test file's directory-independent
    // name via "unrelated" — use a task term that hits the test file itself.
    const result = await rankFilesForTask({ task: 'improve unrelated behavior', snapshot });
    const prodFile = result.files.find((f) => f.path === 'src/unrelated.ts');
    expect(prodFile?.reasons.some((r) => r.kind === 'test-counterpart')).toBe(true);
  });
});

describe('rankFilesForTask: determinism and ordering', () => {
  it('produces identical output across repeated runs', async () => {
    const snapshot = makeSnapshot({
      files: [
        makeFile({ path: 'src/context.ts' }),
        makeFile({ path: 'src/context-helper.ts' }),
        makeFile({ path: 'src/other.ts' }),
      ],
    });
    const first = await rankFilesForTask({ task: 'improve context ranking', snapshot });
    const second = await rankFilesForTask({ task: 'improve context ranking', snapshot });
    expect(first.files).toEqual(second.files);
  });

  it('breaks ties deterministically by ascending normalized path', async () => {
    const snapshot = makeSnapshot({
      files: [
        makeFile({ path: 'src/b-context.ts' }),
        makeFile({ path: 'src/a-context.ts' }),
        makeFile({ path: 'src/c-context.ts' }),
      ],
    });
    const result = await rankFilesForTask({ task: 'context', snapshot });
    const scores = new Set(result.files.map((f) => f.score));
    expect(scores.size).toBe(1); // all three score identically
    expect(result.files.map((f) => f.path)).toEqual([
      'src/a-context.ts',
      'src/b-context.ts',
      'src/c-context.ts',
    ]);
  });
});

describe('RANKING_WEIGHTS', () => {
  it('is a single, named, positive-weight configuration object', () => {
    for (const [name, weight] of Object.entries(RANKING_WEIGHTS)) {
      expect(weight, `${name} should be a positive weight`).toBeGreaterThan(0);
    }
  });
});

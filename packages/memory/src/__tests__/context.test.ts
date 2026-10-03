import { describe, expect, it } from 'vitest';
import { generateContext } from '../context.js';
import { estimateTokens } from '../token-estimate.js';
import { makeSnapshot } from './test-helpers.js';

describe('generateContext', () => {
  it('includes all twelve required sections', () => {
    const { content } = generateContext(makeSnapshot());
    for (let i = 1; i <= 12; i++) {
      expect(content).toContain(`## ${i}.`);
    }
  });

  it('is deterministic for the same snapshot and options', () => {
    const snapshot = makeSnapshot({
      entryPoints: [{ path: 'src/main.ts', workspace: null, kind: 'main', evidence: [] }],
    });
    const first = generateContext(snapshot);
    const second = generateContext(snapshot);
    expect(first.content).toBe(second.content);
  });

  it('renders evidence-backed architecture for a single-workspace framework project', () => {
    const snapshot = makeSnapshot({
      projectProfile: {
        language: 'TypeScript',
        applicationType: 'api-service',
        repositoryType: 'single-package',
        frameworks: ['nestjs'],
      },
      frameworks: [
        {
          name: 'nestjs',
          workspace: '.',
          confidence: 'high',
          evidence: [{ path: 'package.json', reason: 'NestJS dependency detected' }],
        },
      ],
      entryPoints: [
        {
          path: 'src/main.ts',
          workspace: '.',
          kind: 'framework-convention',
          evidence: [{ path: 'src/main.ts', reason: 'NestJS bootstrap convention' }],
        },
      ],
      internalEdges: [
        {
          from: 'src/main.ts',
          to: 'src/app.module.ts',
          kind: 'import',
          dependencyType: 'runtime',
          evidence: [{ path: 'src/main.ts', reason: 'Static import' }],
        },
      ],
    });

    const { content } = generateContext(snapshot);

    expect(content).toContain('Project shape: TypeScript API service');
    expect(content).toContain('Frameworks: nestjs');
    expect(content).toContain('Entry point: `src/main.ts`');
    expect(content).toContain('`src/main.ts` → `src/app.module.ts`');
    expect(content).not.toContain('## 3. Architecture\n\n_None detected._');
  });

  it('surfaces files matching task keywords ahead of generic entry points', () => {
    const snapshot = makeSnapshot({
      files: [
        {
          path: 'src/auth/login.ts',
          workspace: null,
          kind: 'source',
          sizeBytes: 10,
          extension: '.ts',
        },
        {
          path: 'src/billing/invoice.ts',
          workspace: null,
          kind: 'source',
          sizeBytes: 10,
          extension: '.ts',
        },
      ],
    });
    const { content } = generateContext(snapshot, { task: 'Fix the login flow' });
    expect(content).toContain('src/auth/login.ts');
  });

  it('respects maxTokens by shrinking list sections', () => {
    const manyEntryPoints = Array.from({ length: 50 }, (_, i) => ({
      path: `src/module-${i}.ts`,
      workspace: null as string | null,
      kind: 'main' as const,
      evidence: [],
    }));
    const snapshot = makeSnapshot({ entryPoints: manyEntryPoints });

    const unbounded = generateContext(snapshot);
    const bounded = generateContext(snapshot, { maxTokens: 200 });

    expect(bounded.estimatedTokens).toBeLessThanOrEqual(estimateTokens(unbounded.content));
    expect(bounded.truncated).toBe(true);
  });
});

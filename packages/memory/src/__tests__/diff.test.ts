import { describe, expect, it } from 'vitest';
import { diffSnapshots } from '../diff.js';
import { makeSnapshot } from './test-helpers.js';

describe('diffSnapshots', () => {
  it('detects added and removed files', () => {
    const previous = makeSnapshot({
      files: [
        { path: 'src/a.ts', workspace: null, kind: 'source', sizeBytes: 10, extension: '.ts' },
      ],
    });
    const current = makeSnapshot({
      files: [
        { path: 'src/b.ts', workspace: null, kind: 'source', sizeBytes: 10, extension: '.ts' },
      ],
    });

    const report = diffSnapshots(previous, current);
    expect(report.filesAdded).toEqual(['src/b.ts']);
    expect(report.filesRemoved).toEqual(['src/a.ts']);
    expect(report.hasChanges).toBe(true);
  });

  it('detects changed files via size difference', () => {
    const previous = makeSnapshot({
      files: [
        { path: 'src/a.ts', workspace: null, kind: 'source', sizeBytes: 10, extension: '.ts' },
      ],
    });
    const current = makeSnapshot({
      files: [
        { path: 'src/a.ts', workspace: null, kind: 'source', sizeBytes: 50, extension: '.ts' },
      ],
    });

    const report = diffSnapshots(previous, current);
    expect(report.filesChanged).toEqual(['src/a.ts']);
  });

  it('detects added and removed workspace packages', () => {
    const previous = makeSnapshot({
      workspaces: [
        {
          name: 'a',
          path: 'packages/a',
          kind: 'package',
          version: '1.0.0',
          private: true,
          dependsOn: [],
          main: null,
          scripts: {},
        },
      ],
    });
    const current = makeSnapshot({
      workspaces: [
        {
          name: 'b',
          path: 'packages/b',
          kind: 'package',
          version: '1.0.0',
          private: true,
          dependsOn: [],
          main: null,
          scripts: {},
        },
      ],
    });

    const report = diffSnapshots(previous, current);
    expect(report.packagesAdded).toEqual(['b']);
    expect(report.packagesRemoved).toEqual(['a']);
  });

  it('detects dependency version changes', () => {
    const previous = makeSnapshot({
      dependencies: [{ name: 'lodash', version: '^4.17.0', scope: 'dependency', workspace: null }],
    });
    const current = makeSnapshot({
      dependencies: [{ name: 'lodash', version: '^4.18.0', scope: 'dependency', workspace: null }],
    });

    const report = diffSnapshots(previous, current);
    expect(report.dependencyChanges).toEqual([
      { name: 'lodash', workspace: null, scope: 'dependency', from: '^4.17.0', to: '^4.18.0' },
    ]);
  });

  it('detects newly introduced and resolved risks', () => {
    const previous = makeSnapshot({
      risks: [
        {
          category: 'missing-tests',
          severity: 'high',
          description: 'No tests found.',
          evidence: [],
        },
      ],
    });
    const current = makeSnapshot({
      risks: [
        {
          category: 'missing-lockfile',
          severity: 'medium',
          description: 'No lockfile found.',
          evidence: [],
        },
      ],
    });

    const report = diffSnapshots(previous, current);
    expect(report.risksIntroduced.map((r) => r.category)).toEqual(['missing-lockfile']);
    expect(report.risksResolved.map((r) => r.category)).toEqual(['missing-tests']);
  });

  it('reports no changes for an identical snapshot pair', () => {
    const snapshot = makeSnapshot({
      files: [
        { path: 'src/a.ts', workspace: null, kind: 'source', sizeBytes: 10, extension: '.ts' },
      ],
    });
    const report = diffSnapshots(snapshot, snapshot);
    expect(report.hasChanges).toBe(false);
  });
});

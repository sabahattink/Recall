import { describe, expect, it } from 'vitest';
import { computeStaleness } from '../staleness.js';
import { diffSnapshots } from '../diff.js';
import { makeSnapshot } from './test-helpers.js';

describe('computeStaleness', () => {
  it('is stale when no snapshot has ever been recorded', () => {
    const result = computeStaleness({
      snapshotExists: false,
      snapshotCommit: null,
      currentCommit: 'abc',
      changeReport: null,
    });
    expect(result.stale).toBe(true);
    expect(result.reasons[0]).toMatch(/no snapshot/);
  });

  it('is stale when the commit has moved', () => {
    const result = computeStaleness({
      snapshotExists: true,
      snapshotCommit: 'abc',
      currentCommit: 'def',
      changeReport: null,
    });
    expect(result.stale).toBe(true);
  });

  it('is not stale when the commit matches and there are no file changes', () => {
    const result = computeStaleness({
      snapshotExists: true,
      snapshotCommit: 'abc',
      currentCommit: 'abc',
      changeReport: null,
    });
    expect(result.stale).toBe(false);
  });

  it('is stale when a change report shows file differences even on the same commit', () => {
    const previous = makeSnapshot({
      files: [
        { path: 'src/a.ts', workspace: null, kind: 'source', sizeBytes: 10, extension: '.ts' },
      ],
    });
    const current = makeSnapshot({
      files: [
        { path: 'src/a.ts', workspace: null, kind: 'source', sizeBytes: 10, extension: '.ts' },
        { path: 'src/b.ts', workspace: null, kind: 'source', sizeBytes: 10, extension: '.ts' },
      ],
    });
    const changeReport = diffSnapshots(previous, current);
    const result = computeStaleness({
      snapshotExists: true,
      snapshotCommit: 'abc',
      currentCommit: 'abc',
      changeReport,
    });
    expect(result.stale).toBe(true);
  });

  it('is not stale for a persisted snapshot with no commit (non-Git repository) and no changes', () => {
    // A snapshot taken in a repository with no Git history legitimately has
    // a null commit on both sides; that must not be confused with "no
    // snapshot was ever recorded".
    const result = computeStaleness({
      snapshotExists: true,
      snapshotCommit: null,
      currentCommit: null,
      changeReport: null,
    });
    expect(result.stale).toBe(false);
  });

  it('is stale for a non-Git repository once a change report shows file differences', () => {
    const previous = makeSnapshot({
      files: [
        { path: 'src/a.ts', workspace: null, kind: 'source', sizeBytes: 10, extension: '.ts' },
      ],
    });
    const current = makeSnapshot({
      files: [
        { path: 'src/a.ts', workspace: null, kind: 'source', sizeBytes: 20, extension: '.ts' },
      ],
    });
    const changeReport = diffSnapshots(previous, current);
    const result = computeStaleness({
      snapshotExists: true,
      snapshotCommit: null,
      currentCommit: null,
      changeReport,
    });
    expect(result.stale).toBe(true);
  });
});

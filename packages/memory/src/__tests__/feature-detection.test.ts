import { describe, expect, it } from 'vitest';
import {
  analysisNoiseTree,
  nextRoutingVariantsTree,
} from '@recall-ai/test-fixtures';
import type { FileRecord } from '@recall-ai/schemas';
import { detectFeatureCandidates } from '../feature-detection.js';

function records(tree: Record<string, string>): FileRecord[] {
  return Object.keys(tree).map((path) => ({
    path,
    workspace: null,
    kind: /\.[jt]sx?$/.test(path) ? 'source' : 'other',
    sizeBytes: tree[path]?.length ?? 0,
    extension: path.includes('.') ? '.' + (path.split('.').pop() ?? '') : '',
  }));
}

describe('detectFeatureCandidates', () => {
  it('detects App Router and Pages Router routes without corrupting workspace prefixes', () => {
    const candidates = detectFeatureCandidates(records(nextRoutingVariantsTree()));
    const compact = candidates.map((candidate) => ({
      category: candidate.category,
      name: candidate.name,
      paths: candidate.evidence.map((evidence) => evidence.path).sort(),
    }));

    expect(compact).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'next-page',
          name: '/',
          paths: expect.arrayContaining(['app/page.tsx', 'pages/index.tsx']),
        }),
        expect.objectContaining({ category: 'next-route', name: '/' }),
        expect.objectContaining({ category: 'next-page', name: 'changelog' }),
        expect.objectContaining({ category: 'next-route', name: 'api/webhooks' }),
        expect.objectContaining({ category: 'next-page', name: 'about' }),
        expect.objectContaining({ category: 'next-page', name: 'blog/[slug]' }),
        expect.objectContaining({ category: 'next-route', name: 'api/health' }),
      ]),
    );
    expect(candidates.some((candidate) => candidate.name.includes('srcchangelog'))).toBe(false);
    expect(
      candidates.some((candidate) => candidate.evidence.some((e) => e.path === 'pages/_app.tsx')),
    ).toBe(false);
  });

  it('excludes noisy analysis directories by default and allows explicit include overrides', () => {
    const files = records(analysisNoiseTree());

    const defaultCandidates = detectFeatureCandidates(files);
    expect(defaultCandidates.map((candidate) => candidate.name)).toEqual(['order']);

    const included = detectFeatureCandidates(files, {
      ignore: [],
      include: ['examples/reference/**'],
    });
    expect(included.map((candidate) => candidate.name)).toEqual(
      expect.arrayContaining(['order', 'reference']),
    );

    const ignored = detectFeatureCandidates(files, {
      ignore: ['src/orders/**'],
      include: [],
    });
    expect(ignored.some((candidate) => candidate.name === 'order')).toBe(false);
  });
});

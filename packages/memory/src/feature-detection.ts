import type { Evidence, FileRecord } from '@recall-ai/schemas';

export interface FeatureCandidate {
  name: string;
  category: string;
  evidence: Evidence[];
}

const PATTERNS: Array<{ category: string; test: RegExp; nameFrom: (path: string) => string }> = [
  {
    category: 'controller',
    test: /(^|\/)([^/]+)\.controller\.[jt]s$/,
    nameFrom: (path) => baseNameWithoutSuffix(path, '.controller'),
  },
  {
    category: 'module',
    test: /(^|\/)([^/]+)\.module\.[jt]s$/,
    nameFrom: (path) => baseNameWithoutSuffix(path, '.module'),
  },
  {
    category: 'job-processor',
    test: /(^|\/)([^/]+)\.(processor|worker|consumer)\.[jt]s$/,
    nameFrom: (path) =>
      baseNameWithoutSuffix(path, '.processor').replace(/\.(worker|consumer)$/, ''),
  },
  {
    category: 'event-handler',
    test: /(^|\/)([^/]+)\.(handler|listener)\.[jt]s$/,
    nameFrom: (path) => baseNameWithoutSuffix(path, '.handler').replace(/\.listener$/, ''),
  },
  {
    category: 'next-route',
    test: /(^|\/)app\/.*\/route\.[jt]s$/,
    nameFrom: (path) => path.replace(/(^|\/)app\//, '').replace(/\/route\.[jt]s$/, ''),
  },
  {
    category: 'next-page',
    test: /(^|\/)(app|pages)\/.*\/page\.[jt]sx?$/,
    nameFrom: (path) => path.replace(/(^|\/)(app|pages)\//, '').replace(/\/page\.[jt]sx?$/, ''),
  },
];

function baseNameWithoutSuffix(path: string, suffix: string): string {
  const file = path.split('/').pop() ?? path;
  return file.replace(suffix + file.match(/\.[jt]s$/)?.[0], '').replace(suffix, '');
}

/**
 * Finds files that are strong, conventional evidence of a discrete feature
 * (a controller, a route, a job processor, and so on). This is intentionally
 * narrow: Recall lists only what a file name or directory convention makes
 * unambiguous, never inferred business intent.
 */
export function detectFeatureCandidates(files: FileRecord[]): FeatureCandidate[] {
  const byKey = new Map<string, FeatureCandidate>();

  for (const file of files) {
    for (const pattern of PATTERNS) {
      if (!pattern.test.test(file.path)) continue;
      const name = pattern.nameFrom(file.path) || file.path;
      const key = `${pattern.category}:${name}`;
      const existing = byKey.get(key);
      const evidence: Evidence = {
        path: file.path,
        reason: `matches ${pattern.category} naming convention`,
      };
      if (existing) {
        existing.evidence.push(evidence);
      } else {
        byKey.set(key, { name, category: pattern.category, evidence: [evidence] });
      }
    }
  }

  return [...byKey.values()].sort(
    (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
  );
}

import {
  DEFAULT_RECALL_CONFIG,
  shouldAnalyzePath,
  type Evidence,
  type FileRecord,
  type RecallConfig,
} from '@recall-ai/schemas';

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
];

function baseNameWithoutSuffix(path: string, suffix: string): string {
  const file = path.split('/').pop() ?? path;
  return file.replace(suffix + file.match(/\.[jt]s$/)?.[0], '').replace(suffix, '');
}

function routeName(parts: string[]): string {
  return parts.length === 0 || (parts.length === 1 && parts[0] === 'index') ? '/' : parts.join('/');
}

function nextFeatureForPath(path: string): { category: string; name: string } | null {
  const segments = path.split('/').filter(Boolean);

  // App Router: match both app/... and src/app/... anywhere inside a
  // workspace. Using segments instead of a replace() preserves the separator
  // between a workspace prefix and the route name (the old implementation
  // turned apps/web/src/app/changelog into apps/web/srcchangelog).
  const appIndex = segments.lastIndexOf('app');
  if (appIndex >= 0) {
    const file = segments.at(-1) ?? '';
    const routeParts = segments.slice(appIndex + 1, -1);

    if (/^route\.[jt]s$/.test(file)) {
      return { category: 'next-route', name: routeName(routeParts) };
    }
    if (/^page\.[jt]sx?$/.test(file)) {
      return { category: 'next-page', name: routeName(routeParts) };
    }
  }

  // Pages Router: pages/index.tsx and pages/foo/[id].tsx are pages; files
  // below pages/api are request routes. Support src/pages as well because it
  // is a standard Next.js layout.
  const pagesIndex = segments.lastIndexOf('pages');
  if (pagesIndex >= 0) {
    const file = segments.at(-1) ?? '';
    const stem = file.replace(/\.[jt]sx?$/, '');
    if (stem === file || ['_app', '_document', '_error'].includes(stem)) return null;

    const pathParts = [...segments.slice(pagesIndex + 1, -1), stem];
    if (pathParts[0] === 'api') {
      return { category: 'next-route', name: routeName(pathParts) };
    }
    return { category: 'next-page', name: routeName(pathParts) };
  }

  return null;
}

/**
 * Finds files that are strong, conventional evidence of a discrete feature
 * (a controller, a route, a job processor, and so on). This is intentionally
 * narrow: Recall lists only what a file name or directory convention makes
 * unambiguous, never inferred business intent.
 */
export function detectFeatureCandidates(
  files: FileRecord[],
  config: RecallConfig = DEFAULT_RECALL_CONFIG,
): FeatureCandidate[] {
  const byKey = new Map<string, FeatureCandidate>();

  const addCandidate = (file: FileRecord, category: string, name: string): void => {
    const normalizedName = name || file.path;
    const key = `${category}:${normalizedName}`;
    const existing = byKey.get(key);
    const evidence: Evidence = {
      path: file.path,
      reason: `matches ${category} naming convention`,
    };
    if (existing) {
      existing.evidence.push(evidence);
    } else {
      byKey.set(key, { name: normalizedName, category, evidence: [evidence] });
    }
  };

  for (const file of files) {
    if (!shouldAnalyzePath(file.path, config, file.kind)) continue;

    const nextFeature = nextFeatureForPath(file.path);
    if (nextFeature) {
      addCandidate(file, nextFeature.category, nextFeature.name);
      continue;
    }

    for (const pattern of PATTERNS) {
      if (!pattern.test.test(file.path)) continue;
      addCandidate(file, pattern.category, pattern.nameFrom(file.path));
    }
  }

  return [...byKey.values()].sort(
    (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
  );
}

import { z } from 'zod';

export const RecallConfigSchema = z
  .object({
    ignore: z.array(z.string()).default([]),
    include: z.array(z.string()).default([]),
  })
  .default({ ignore: [], include: [] });

export type RecallConfig = z.infer<typeof RecallConfigSchema>;

export const DEFAULT_RECALL_CONFIG: RecallConfig = {
  ignore: [],
  include: [],
};

/**
 * Noise-heavy paths that remain part of the repository snapshot when they
 * are scanned, but are excluded from feature/glossary/risk analysis by
 * default. `include` patterns in .recall/config.json can opt matching
 * scanned paths back in.
 */
export const DEFAULT_ANALYSIS_IGNORE = [
  '**/test-fixtures/**',
  '**/__fixtures__/**',
  '**/fixtures/**',
  '**/__mocks__/**',
  '**/examples/**',
  '**/example/**',
  '**/generated/**',
  '**/vendor/**',
  '**/vendored/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.next/**',
  '**/out/**',
] as const;

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/{2,}/g, '/');
}

function globToRegExp(pattern: string): RegExp {
  const normalized = normalizePath(pattern.trim()).replace(/^\//, '');
  let source = '^';

  for (let index = 0; index < normalized.length; index++) {
    const char = normalized[index] as string;
    const next = normalized[index + 1];

    if (char === '*' && next === '*') {
      const after = normalized[index + 2];
      if (after === '/') {
        source += '(?:.*/)?';
        index += 2;
      } else {
        source += '.*';
        index += 1;
      }
      continue;
    }

    if (char === '*') {
      source += '[^/]*';
      continue;
    }

    if (char === '?') {
      source += '[^/]';
      continue;
    }

    source += char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
  }

  source += '$';
  return new RegExp(source);
}

function matchesPattern(path: string, pattern: string): boolean {
  if (!pattern.trim()) return false;
  const normalizedPattern = pattern.endsWith('/') ? `${pattern}**` : pattern;
  return globToRegExp(normalizedPattern).test(normalizePath(path));
}

/**
 * Returns whether a scanned repository path should contribute to
 * feature/glossary/risk analysis.
 *
 * Explicit includes win over both default and user ignore patterns. Hard
 * scanner exclusions such as node_modules/.git/.recall never reach this
 * function and therefore cannot be re-included here.
 */
export function shouldAnalyzePath(
  path: string,
  config: RecallConfig = DEFAULT_RECALL_CONFIG,
  fileKind?: string,
): boolean {
  if (config.include.some((pattern) => matchesPattern(path, pattern))) return true;
  if (fileKind === 'generated') return false;

  return ![...DEFAULT_ANALYSIS_IGNORE, ...config.ignore].some((pattern) =>
    matchesPattern(path, pattern),
  );
}

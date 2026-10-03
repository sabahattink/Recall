import type { EntryPoint } from '@recall-ai/schemas';

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

/**
 * Produces a compact human-facing label for a deduplicated entry point.
 * The snapshot keeps the stable enum `kind`; merged declaration detail is
 * recovered from evidence so no snapshot-schema change is required.
 */
export function formatEntryPointKind(entry: EntryPoint): string {
  const binNames = uniqueSorted(
    entry.evidence.flatMap((evidence) => {
      const match = evidence.reason.match(/^bin entry "([^"]+)" declared$/);
      return match?.[1] ? [match[1]] : [];
    }),
  );
  const scriptNames = uniqueSorted(
    entry.evidence.flatMap((evidence) => {
      const match = evidence.reason.match(/^"([^"]+)" script runs:/);
      return match?.[1] ? [match[1]] : [];
    }),
  );
  const hasMain = entry.evidence.some((evidence) =>
    evidence.reason.includes('package.json "main" field'),
  );

  const labels: string[] = [];
  if (binNames.length > 0) labels.push(`bin: ${binNames.join(', ')}`);
  if (hasMain) labels.push('main');
  if (scriptNames.length > 0) labels.push(`script: ${scriptNames.join(', ')}`);

  return labels.length > 0 ? labels.join('; ') : entry.kind;
}

/**
 * Not part of `@recall-ai/analyzers`'s public surface — `index.ts` never
 * re-exports this module. It exists purely as a seam so tests can drive the
 * streaming-truncation logic with a cheap synthetic entry source (thousands
 * of in-memory strings) instead of thousands of real files on disk, to prove
 * `walkRepository` stops pulling entries once `maxFiles` is reached.
 */
export async function collectTruncated(
  entries: AsyncIterable<string>,
  isIgnored: (entry: string) => boolean,
  maxFiles: number,
): Promise<{ matchedEntries: string[]; truncated: boolean }> {
  const matchedEntries: string[] = [];
  let truncated = false;

  for await (const entry of entries) {
    if (isIgnored(entry)) continue;
    matchedEntries.push(entry);
    if (matchedEntries.length >= maxFiles) {
      truncated = true;
      break;
    }
  }

  return { matchedEntries, truncated };
}

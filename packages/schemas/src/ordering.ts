/**
 * The one ordering every sorted list in Recall's output uses: UTF-16 code
 * unit order, exactly like `Array.prototype.sort()` with no comparator.
 * Never `localeCompare`, whose result depends on the machine's ICU locale
 * (e.g. Turkish dotted/dotless "i") — output must be byte-identical on
 * every machine (docs/product-specification.md §9, Deterministic).
 */
export function compareStrings(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

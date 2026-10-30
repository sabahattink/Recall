/**
 * Literal facts about what `recall init` prints and writes, shared by every
 * page that shows them. Both values are copied verbatim from
 * docs/product-specification.md (§11 and §12); `product-facts.test.ts`
 * fails the moment either drifts from the specification.
 */

/** Exact stdout of a successful `recall init` (spec §11). */
export const initOutputLines = [
  'Scanning repository...',
  'Detecting architecture...',
  'Generating AI memory...',
  'Done.',
] as const;

/** The complete output of `recall init` (spec §12). */
export const outputTree = [
  '.recall/',
  '├── memory.json',
  '└── agents/',
  '    ├── claude.md',
  '    ├── codex.md',
  '    ├── cursor.md',
  '    ├── gemini.md',
  '    └── openai.md',
].join('\n');

/** Top-level keys of `memory.json`, in file order. */
export const memoryTopLevelKeys = [
  'schemaVersion',
  'metadata',
  'stack',
  'architecture',
  'structure',
  'commands',
  'conventions',
  'dependencies',
  'risks',
] as const;

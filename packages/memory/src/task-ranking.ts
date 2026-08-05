import type { FileRecord, RepositorySnapshot } from '@recall-ai/schemas';

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

/**
 * Generic words that carry no search signal on their own. Deliberately does
 * NOT include domain/technical terms (context, ranking, auth, password,
 * reset, prisma, queue, redis, controller, service, ...) — those are exactly
 * what ranking needs to preserve.
 */
const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'to',
  'of',
  'for',
  'in',
  'on',
  'with',
  'is',
  'are',
  'this',
  'that',
  'it',
  'be',
  'as',
  'at',
  'by',
  'from',
  'into',
  'so',
  'not',
  'can',
  'should',
  'will',
  'when',
  'if',
  'add',
  'implement',
  'create',
  'fix',
  'update',
  'improve',
  'make',
  'ensure',
  'support',
  'handle',
  'using',
  'use',
  'via',
]);

/** Words a naive trailing-"s" strip would corrupt; never destem these. */
const PLURAL_EXCEPTIONS = new Set(['status', 'process', 'address', 'class', 'access', 'this']);

/**
 * Splits a raw word/phrase into lowercase pieces: punctuation (including
 * kebab-case `-` and snake_case `_`) is a hard boundary, and camelCase /
 * PascalCase transitions are turned into boundaries before that split runs.
 * This is the single primitive both task tokenization and path/filename
 * tokenization are built on, so a task token and a path token are always
 * comparable on equal footing.
 */
function splitWords(raw: string): string[] {
  const withBoundaries = raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return withBoundaries
    .split(/[^a-zA-Z0-9]+/)
    .map((w) => w.toLowerCase())
    .filter(Boolean);
}

/**
 * Deterministically tokenizes a natural-language task description: lowercase
 * + punctuation/case-boundary splitting via `splitWords`, stop-word removal,
 * and a conservative, additive singular/plural normalization (the plural
 * form is always kept; a shortened form is added alongside it only when
 * stripping a trailing "s" is unlikely to corrupt the word). No stemming
 * library is used — this stays a handful of deterministic string rules.
 */
export function tokenizeTask(task: string): string[] {
  const tokens = new Set<string>();

  for (const word of splitWords(task)) {
    if (word.length < 2 || STOP_WORDS.has(word)) continue;
    tokens.add(word);

    if (/(ch|sh|x|ss)es$/.test(word) && word.length > 5) {
      tokens.add(word.slice(0, -2));
    } else if (
      word.endsWith('s') &&
      !word.endsWith('ss') &&
      word.length > 4 &&
      !PLURAL_EXCEPTIONS.has(word)
    ) {
      tokens.add(word.slice(0, -1));
    }

    // Additive gerund normalization: "packaging" should also relate to
    // "package", "testing" to "test", "building" to "build". Both the
    // plain ing-stripped form and the form with a dropped trailing "e"
    // restored are added as candidates — harmless if neither is a real
    // word, since these are pure additions, never replacements.
    if (word.endsWith('ing') && word.length > 6) {
      const stem = word.slice(0, -3);
      tokens.add(stem);
      tokens.add(`${stem}e`);
    }
  }

  return [...tokens].sort();
}

/**
 * The task's words in the order the author wrote them (stop-words removed,
 * no stemming/pluralization added) — used only for phrase-adjacency
 * detection, where word order matters. `tokenizeTask` itself returns a
 * sorted, deduplicated set instead, since that's what every other signal
 * needs for consistent, order-independent matching.
 */
function taskPhraseTokens(task: string): string[] {
  return splitWords(task).filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
}

/**
 * Collapses a set of matched task terms into distinct *concept* groups: the
 * tokenizer additively adds stem/gerund variants of the same word ("packag",
 * "package", "packaging" all come from one task word), and those must never
 * count as multiple independent matches for multi-term density — otherwise
 * a file that only really matches one generic word gets an undeserved
 * density bonus purely from the tokenizer's own additive stemming.
 */
function distinctTermGroups(matchedTerms: Set<string>): string[] {
  const groups: string[] = [];
  for (const term of matchedTerms) {
    if (!groups.some((g) => tokensRelate(g, term))) groups.push(term);
  }
  return groups;
}

/** True if two of `matchedTerms` correspond to adjacent words in the task phrase as written. */
function hasAdjacentMatch(matchedTerms: Set<string>, phraseTokens: string[]): boolean {
  const terms = [...matchedTerms];
  for (let i = 0; i < phraseTokens.length - 1; i++) {
    const left = phraseTokens[i] as string;
    const right = phraseTokens[i + 1] as string;
    if (left === right) continue;
    const leftMatched = terms.some((t) => tokensRelate(t, left));
    const rightMatched = terms.some((t) => tokensRelate(t, right));
    if (leftMatched && rightMatched) return true;
  }
  return false;
}

/** Two tokens "relate" if identical, or — for tokens long enough to avoid noise — one contains the other. */
function tokensRelate(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  return a.includes(b) || b.includes(a);
}

function anyTokenRelates(taskTokens: string[], candidateTokens: string[]): string | null {
  for (const candidate of candidateTokens) {
    for (const taskToken of taskTokens) {
      if (tokensRelate(taskToken, candidate)) return taskToken;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Ranking model
// ---------------------------------------------------------------------------

export type RankingReasonKind =
  | 'path-term'
  | 'filename-term'
  | 'symbol-term'
  | 'workspace-match'
  | 'import-neighbor'
  | 'reverse-import-neighbor'
  | 'test-counterpart'
  | 'entry-point'
  | 'config-relevance'
  | 'multi-term-density'
  | 'workspace-locality';

export interface RankingReason {
  kind: RankingReasonKind;
  weight: number;
  evidence: string;
}

export interface RankedFile {
  path: string;
  score: number;
  reasons: RankingReason[];
}

export interface TaskRankingInput {
  task: string;
  snapshot: RepositorySnapshot;
}

export interface TaskRankingStats {
  tokenCount: number;
  filesConsidered: number;
  seedCount: number;
  graphNodesVisited: number;
  elapsedMs: number;
}

export interface TaskRankingResult {
  tokens: string[];
  files: RankedFile[];
  stats: TaskRankingStats;
}

/**
 * All ranking weights in one place, by design: every signal's contribution
 * is a named, documented constant here rather than a number scattered
 * through scoring logic, so weighting can be reasoned about and tested as a
 * unit.
 */
export const RANKING_WEIGHTS = {
  filenameTermExact: 40,
  filenameTermPartial: 25,
  pathTermExact: 18,
  pathTermPartial: 10,
  symbolTerm: 22,
  workspaceMatch: 10,
  importNeighbor: 15,
  reverseImportNeighbor: 12,
  secondDegreeNeighbor: 6,
  testCounterpart: 20,
  entryPoint: 8,
  // Deliberately modest: "the task mentions build/CI/tooling" matches every
  // config file in a large monorepo at once, so this must never outweigh a
  // signal actually tied to a specific file (a filename/symbol match, or a
  // real import-graph relationship) — otherwise a task like "fix the
  // Windows packaging shebang" gets buried under every package.json in the
  // repo instead of surfacing the file that actually needed fixing.
  configRelevance: 6,
  // A file matching two or more *distinct* task terms (not the same term
  // via two signals) is meaningfully more likely to be the right file than
  // one that only happens to share a single generic word with the task.
  // Flat base once the >=2 threshold is met, plus a small per-extra-term
  // step, both folded under one absolute cap (see multiTermDensityCap).
  multiTermDensity: 10,
  multiTermDensityStep: 4,
  multiTermDensityCap: 24,
  // Extra bonus when two of the file's matched terms are also adjacent to
  // each other in the task phrase as written (e.g. "packaging shebang"),
  // not just independently present — this is still plain substring/
  // containment matching, never fuzzy.
  phraseAdjacencyBonus: 8,
  // Modest, bounded boost for a file that shares a workspace with a strong
  // Stage 1 seed. Only ever applied on top of an existing positive score or
  // to a workspace's own config file — it cannot make an unrelated file
  // relevant on its own.
  workspaceLocality: 12,
} as const;

/**
 * Term specificity is an inverse-document-frequency-style multiplier applied
 * to every term-driven signal (filename/path/symbol/workspace/config-
 * relevance): a task term that matches almost every eligible file (e.g. the
 * literal word "package" in a package-manager-based monorepo, where nearly
 * every workspace has both a top-level `packages/` path segment and a
 * `package.json`) contributes far less than a term that matches only a
 * handful of files (e.g. "shebang"). Computed purely from already-scanned
 * snapshot metadata — no extra file reads — and always clamped to a
 * documented, never-zero range so a generic term still counts, just less.
 */
export const TERM_SPECIFICITY_MIN = 0.25;
export const TERM_SPECIFICITY_MAX = 2.5;

/**
 * A curated set of low-information ecosystem/tooling words. Matching one of
 * these terms *alone* is weak evidence — almost every repository has a
 * "package.json", a "build" script, and "test" files — so standalone matches
 * are further dampened beyond what data-driven specificity alone would give
 * them. They still count (multiTermDensity rewards them in combination with
 * a second, more specific term), and this set deliberately never includes
 * domain/product terms: password, reset, controller, queue, redis, context,
 * ranking, shebang, bundle, auth, prisma, service, etc. all keep their full
 * weight, exactly as intended by Sprint 2's tokenizer.
 */
const GENERIC_ECOSYSTEM_TERMS = new Set([
  'package',
  'packages',
  'npm',
  'pnpm',
  'yarn',
  'build',
  'test',
  'tests',
  'testing',
  'config',
  'configuration',
  'script',
  'scripts',
  'file',
  'files',
  'code',
  'update',
  'fix',
]);
const GENERIC_TERM_DAMPENING = 0.5;

/**
 * Basename specificity dampens the filename-term signal only, separately
 * from term specificity: a term can be rare (e.g. it matches few files) while
 * still landing on a basename that itself repeats dozens of times across a
 * monorepo (every workspace has its own `package.json`). Gentler bound than
 * term specificity since basename repetition alone is weaker evidence of
 * irrelevance than a genuinely generic term.
 */
const BASENAME_SPECIFICITY_MIN = 0.35;

/** Config-relevant work implies these terms; config files only score when the task mentions one. */
const CONFIG_RELEVANT_TERMS = new Set([
  'config',
  'configuration',
  'tooling',
  'build',
  'lint',
  'linting',
  'test',
  'testing',
  'package',
  'packaging',
  'ci',
  'release',
  'workflow',
  'pipeline',
  'deploy',
  'deployment',
]);

/** Dependency/package-manager terms that allow a lockfile to be considered at all. */
const DEPENDENCY_RELEVANT_TERMS = new Set([
  'dependency',
  'dependencies',
  'package',
  'packages',
  'packaging',
  'lockfile',
  'npm',
  'pnpm',
  'yarn',
  'install',
  'version',
  'versions',
  'upgrade',
]);

const FIXTURE_TERMS = new Set(['fixture', 'fixtures', 'test', 'tests', 'testing']);

const LOCKFILE_NAMES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']);

const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.webp',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.pdf',
  '.zip',
  '.gz',
  '.tar',
  '.wasm',
]);

const TEST_PATH_PATTERN = /\.(test|spec)\.[jt]sx?$|(^|\/)__tests__\/|(^|\/)test\/.*\.[jt]sx?$/;
const SNAPSHOT_DIR_PATTERN = /(^|\/)(__snapshots__|snapshots)\//;
const NODE_MODULES_PATTERN = /(^|\/)node_modules\//;
const RECALL_DIR_PATTERN = /(^|\/)\.recall\//;
const FIXTURE_PATH_PATTERN = /(^|\/)(fixtures|test-fixtures)\//;

/** Bounds on Stage 2 graph expansion, so ranking is never proportional to repository size. */
const MAX_SEEDS = 15;
const MAX_GRAPH_DEPTH = 2;
const MAX_GRAPH_NODES_VISITED = 300;
/**
 * A shared/central node (e.g. a common `schemas` or `utils` package nearly
 * everything imports) is a real edge but a useless *proximity* signal —
 * once it enters the frontier, expanding through it would pull in a large,
 * effectively-random slice of the repository at the next depth. Nodes with
 * more total (forward + reverse) edges than this are still recorded as
 * neighbors themselves, just never used as a source for further expansion.
 */
const MAX_HUB_DEGREE = 8;

/** Only the top few seeds count as "strong" for workspace-locality purposes — a weak, borderline seed should not pull its whole workspace along with it. */
const MAX_LOCALITY_SEEDS = 5;
/**
 * A seed only counts as "strong" (for workspace-locality) if its score
 * reaches this fraction of the single best seed's score. Rank position
 * alone is not enough: a repository-wide generic-term match (e.g. "packag"
 * relating to the literal `packages/` path segment) can tie dozens of files
 * at a low score, and without this floor, deterministic path-based
 * tie-breaking would arbitrarily crown one of those low-value files a
 * "strong seed" and spuriously boost its entire workspace.
 */
const STRONG_SEED_RELATIVE_THRESHOLD = 0.4;

/** Hard exclusions: never a ranking candidate, regardless of task. */
function isHardExcluded(file: FileRecord): boolean {
  if (file.kind === 'generated') return true;
  if (NODE_MODULES_PATTERN.test(file.path)) return true;
  if (RECALL_DIR_PATTERN.test(file.path)) return true;
  if (SNAPSHOT_DIR_PATTERN.test(file.path)) return true;
  if (BINARY_EXTENSIONS.has(file.extension.toLowerCase())) return true;
  if (/\.min\.[jt]sx?$/.test(file.path)) return true;
  return false;
}

/** Conditional exclusions: excluded unless the task itself makes the file relevant. */
function isConditionallyExcluded(file: FileRecord, taskTokens: Set<string>): boolean {
  if (FIXTURE_PATH_PATTERN.test(file.path)) {
    return ![...FIXTURE_TERMS].some((term) => taskTokens.has(term));
  }
  const basename = file.path.split('/').pop() ?? '';
  if (LOCKFILE_NAMES.has(basename)) {
    return ![...DEPENDENCY_RELEVANT_TERMS].some((term) => taskTokens.has(term));
  }
  return false;
}

function addReason(
  reasons: RankingReason[],
  kind: RankingReasonKind,
  weight: number,
  evidence: string,
) {
  reasons.push({ kind, weight, evidence });
}

interface FileTokens {
  filename: string[];
  directory: string[];
}

function tokenizePath(path: string): FileTokens {
  const segments = path.split('/');
  const filenamePart = segments[segments.length - 1] ?? '';
  const directoryPart = segments.slice(0, -1).join('/');
  return {
    filename: splitWords(filenamePart),
    directory: splitWords(directoryPart),
  };
}

interface FileTermProfile {
  filename: string[];
  directory: string[];
  symbols: string[];
  /** Union of every category above, used only to compute term specificity. */
  all: string[];
}

function buildFileProfile(file: FileRecord): FileTermProfile {
  const { filename, directory } = tokenizePath(file.path);
  const symbols = file.exportedSymbols?.length
    ? file.exportedSymbols.flatMap((s) => splitWords(s))
    : [];
  return { filename, directory, symbols, all: [...filename, ...directory, ...symbols] };
}

/** True if `term` is, or plausibly stems from, one of the curated generic ecosystem words. */
function isGenericTerm(term: string): boolean {
  for (const generic of GENERIC_ECOSYSTEM_TERMS) {
    if (tokensRelate(term, generic)) return true;
  }
  return false;
}

/**
 * specificity(term) = clamp(lerp(log((N+1)/(matches+1)) / log(N+1))), an
 * inverse-document-frequency-style score normalized into
 * [TERM_SPECIFICITY_MIN, TERM_SPECIFICITY_MAX]: 0 when the term matches
 * every eligible file, 1 (mapped to the max) when it matches none but this
 * one. Combined multiplicatively with a fixed dampening factor for terms in
 * the curated generic-ecosystem set. Never returns 0 or a negative number.
 */
function termWeightMultiplier(
  term: string,
  termMatchCounts: Map<string, number>,
  eligibleFileCount: number,
): number {
  if (eligibleFileCount === 0) return 1;
  const maxRaw = Math.log(eligibleFileCount + 1);
  if (maxRaw === 0) return 1;
  const matchCount = termMatchCounts.get(term) ?? 0;
  const raw = Math.log((eligibleFileCount + 1) / (matchCount + 1));
  const normalized = Math.min(1, Math.max(0, raw / maxRaw));
  const specificity =
    TERM_SPECIFICITY_MIN + normalized * (TERM_SPECIFICITY_MAX - TERM_SPECIFICITY_MIN);
  return specificity * (isGenericTerm(term) ? GENERIC_TERM_DAMPENING : 1);
}

/** Dampens the filename-term signal for basenames that repeat across many workspaces (e.g. every `package.json`). */
function basenameSpecificityMultiplier(
  basename: string,
  basenameCounts: Map<string, number>,
  eligibleFileCount: number,
): number {
  const basenameCount = basenameCounts.get(basename) ?? 1;
  if (eligibleFileCount === 0 || basenameCount <= 1) return 1;
  const maxRaw = Math.log(eligibleFileCount + 1);
  if (maxRaw === 0) return 1;
  const raw = Math.log((eligibleFileCount + 1) / (basenameCount + 1));
  const normalized = Math.min(1, Math.max(0, raw / maxRaw));
  return BASENAME_SPECIFICITY_MIN + normalized * (1 - BASENAME_SPECIFICITY_MIN);
}

/** A weight adjusted by term (and optionally basename) specificity, always rounded to a positive integer. */
function weighTerm(
  baseWeight: number,
  term: string,
  termMatchCounts: Map<string, number>,
  eligibleFileCount: number,
  basename?: string,
  basenameCounts?: Map<string, number>,
): number {
  let multiplier = termWeightMultiplier(term, termMatchCounts, eligibleFileCount);
  if (basename && basenameCounts) {
    multiplier *= basenameSpecificityMultiplier(basename, basenameCounts, eligibleFileCount);
  }
  return Math.max(1, Math.round(baseWeight * multiplier));
}

interface LexicalScoreResult {
  reasons: RankingReason[];
  /** Distinct task terms this file matched, deduplicated across signals — the input to multi-term density. */
  matchedTerms: Set<string>;
}

function scoreLexical(
  file: FileRecord,
  taskTokens: string[],
  phraseTokens: string[],
  workspaceTokensByPath: Map<string, string[]>,
  termMatchCounts: Map<string, number>,
  basenameCounts: Map<string, number>,
  eligibleFileCount: number,
): LexicalScoreResult {
  const reasons: RankingReason[] = [];
  const matchedTerms = new Set<string>();
  const { filename, directory } = tokenizePath(file.path);
  const basename = file.path.split('/').pop() ?? '';

  const filenameMatch = anyTokenRelates(taskTokens, filename);
  if (filenameMatch) {
    matchedTerms.add(filenameMatch);
    const exact = filename.includes(filenameMatch);
    const base = exact ? RANKING_WEIGHTS.filenameTermExact : RANKING_WEIGHTS.filenameTermPartial;
    addReason(
      reasons,
      'filename-term',
      weighTerm(base, filenameMatch, termMatchCounts, eligibleFileCount, basename, basenameCounts),
      `filename matches task term "${filenameMatch}"`,
    );
  }

  const pathMatch = anyTokenRelates(taskTokens, directory);
  if (pathMatch) {
    matchedTerms.add(pathMatch);
    const exact = directory.includes(pathMatch);
    const base = exact ? RANKING_WEIGHTS.pathTermExact : RANKING_WEIGHTS.pathTermPartial;
    addReason(
      reasons,
      'path-term',
      weighTerm(base, pathMatch, termMatchCounts, eligibleFileCount),
      `path segment matches task term "${pathMatch}"`,
    );
  }

  if (file.workspace) {
    const workspaceTokens = workspaceTokensByPath.get(file.workspace) ?? [];
    const workspaceMatch = anyTokenRelates(taskTokens, workspaceTokens);
    if (workspaceMatch) {
      matchedTerms.add(workspaceMatch);
      addReason(
        reasons,
        'workspace-match',
        weighTerm(
          RANKING_WEIGHTS.workspaceMatch,
          workspaceMatch,
          termMatchCounts,
          eligibleFileCount,
        ),
        `workspace "${file.workspace}" matches task term "${workspaceMatch}"`,
      );
    }
  }

  if (file.kind === 'config') {
    // package.json is both a build/tooling config file and the dependency
    // manifest, so either vocabulary should make it relevant — a pure
    // "upgrade the zod dependency" task should still surface it, not just
    // "fix the build/CI packaging".
    // Deliberately NOT added to `matchedTerms`: this is a file-*kind*-wide
    // flag (every config file gets it once the task mentions any CI/build/
    // package term), not evidence tied to this specific file's name/path/
    // symbols — counting it toward multi-term density would give every
    // config file in the repo an undeserved density bonus in combination
    // with the near-universal "packag" filename match.
    const term = taskTokens.find(
      (token) => CONFIG_RELEVANT_TERMS.has(token) || DEPENDENCY_RELEVANT_TERMS.has(token),
    );
    if (term) {
      addReason(
        reasons,
        'config-relevance',
        weighTerm(RANKING_WEIGHTS.configRelevance, term, termMatchCounts, eligibleFileCount),
        'task mentions tooling/build/CI-relevant terms and this is a configuration file',
      );
    }
  }

  // A lockfile that survived isConditionallyExcluded (i.e. the task is
  // dependency-related) is relevant precisely *because* the task is
  // dependency-related — score it the same way a matching config file
  // would be, rather than leaving it at a scoreless zero. Same
  // not-file-specific reasoning as above: not added to `matchedTerms`.
  if (LOCKFILE_NAMES.has(basename)) {
    const term = taskTokens.find((token) => DEPENDENCY_RELEVANT_TERMS.has(token));
    if (term) {
      addReason(
        reasons,
        'config-relevance',
        weighTerm(RANKING_WEIGHTS.configRelevance, term, termMatchCounts, eligibleFileCount),
        `task mentions dependency/package-manager term "${term}" and this is a lockfile`,
      );
    }
  }

  // Exported symbols were already extracted once, at scan time, from the
  // same read pass that builds the import graph (see
  // packages/analyzers/src/import-graph.ts) — ranking never re-reads source
  // files itself, so this signal is pure metadata lookup.
  if (file.exportedSymbols && file.exportedSymbols.length > 0) {
    const symbolTokens = file.exportedSymbols.flatMap((s) => splitWords(s));
    const symbolMatch = anyTokenRelates(taskTokens, symbolTokens);
    if (symbolMatch) {
      matchedTerms.add(symbolMatch);
      addReason(
        reasons,
        'symbol-term',
        weighTerm(RANKING_WEIGHTS.symbolTerm, symbolMatch, termMatchCounts, eligibleFileCount),
        `exports a symbol matching task term "${symbolMatch}"`,
      );
    }
  }

  // Multi-term density: reward a file that independently matches two or
  // more *distinct* task terms over one that only happens to share a single
  // (often generic) word with the task. Requires the >=2 threshold so a
  // single strong match never triggers this on its own.
  const distinctGroups = distinctTermGroups(matchedTerms);
  if (distinctGroups.length >= 2) {
    const extra = distinctGroups.length - 2;
    const densityWeight = Math.min(
      RANKING_WEIGHTS.multiTermDensityCap,
      RANKING_WEIGHTS.multiTermDensity + extra * RANKING_WEIGHTS.multiTermDensityStep,
    );
    const adjacent = hasAdjacentMatch(matchedTerms, phraseTokens);
    const totalWeight = densityWeight + (adjacent ? RANKING_WEIGHTS.phraseAdjacencyBonus : 0);
    addReason(
      reasons,
      'multi-term-density',
      totalWeight,
      `matches ${distinctGroups.length} distinct task terms (${[...distinctGroups].sort().join(', ')})${
        adjacent ? ', including an adjacent pair from the task phrase' : ''
      }`,
    );
  }

  return { reasons, matchedTerms };
}

function testCounterpartPath(file: FileRecord, allPaths: Set<string>): string | null {
  const segments = file.path.split('/');
  const filename = segments[segments.length - 1] ?? '';
  const dotIndex = filename.lastIndexOf('.');
  const stem = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
  const dir = segments.slice(0, -1).join('/');

  const candidates = [
    `${dir}/${stem}.test.ts`,
    `${dir}/${stem}.test.tsx`,
    `${dir}/${stem}.spec.ts`,
    `${dir}/${stem}.test.js`,
    `${dir}/__tests__/${stem}.test.ts`,
    `${dir}/__tests__/${filename}`,
  ];
  return candidates.find((c) => allPaths.has(c)) ?? null;
}

function productionCounterpartPath(file: FileRecord, allPaths: Set<string>): string | null {
  if (!TEST_PATH_PATTERN.test(file.path)) return null;
  const segments = file.path.split('/');
  const filename = segments[segments.length - 1] ?? '';
  const strippedName = filename.replace(/\.(test|spec)\.([jt]sx?)$/, '.$2');
  if (strippedName === filename) return null;

  const dir = segments.slice(0, -1).join('/');
  const dirWithoutTestsSuffix = dir.replace(/\/__tests__$/, '').replace(/^__tests__$/, '');
  const candidates = [`${dir}/${strippedName}`, `${dirWithoutTestsSuffix}/${strippedName}`].filter(
    Boolean,
  );
  return candidates.find((c) => allPaths.has(c)) ?? null;
}

/**
 * Deterministically ranks the files in `input.snapshot` an AI coding agent
 * should read first for `input.task`, using only local, explainable signals
 * — lexical path/filename/symbol matching, workspace matching, import-graph
 * proximity, and test/production counterpart linking. No embeddings, no AI
 * provider, no network access.
 *
 * Two-stage algorithm:
 *   Stage 1 — score every eligible file on lexical/path/symbol/workspace/
 *     config signals alone. This never reads a source file: exported-symbol
 *     data was already extracted once at scan time (see
 *     packages/analyzers/src/import-graph.ts) and travels with the
 *     snapshot, so ranking is pure metadata lookup — safe to call on every
 *     `recall context --task` invocation without re-scanning anything.
 *   Stage 2 — take the strongest Stage 1 seeds and expand through the
 *     import graph (direct + reverse, up to depth 2) and test/production
 *     counterparts, both explicitly bounded so ranking time never scales
 *     with total repository size.
 *
 * Ties are broken by ascending normalized (`/`-separated, lowercase) path,
 * so output is identical across repeated runs and operating systems.
 */
export function rankFilesForTask(input: TaskRankingInput): TaskRankingResult {
  const startedAt = Date.now();
  const tokens = tokenizeTask(input.task);
  const taskTokenSet = new Set(tokens);
  const { snapshot } = input;

  const phraseTokens = taskPhraseTokens(input.task);

  const workspaceTokensByPath = new Map<string, string[]>(
    snapshot.workspaces.map((w) => [w.path, splitWords(w.name)]),
  );

  const eligibleFiles = snapshot.files.filter(
    (f) => !isHardExcluded(f) && !isConditionallyExcluded(f, taskTokenSet),
  );

  // Term/basename specificity denominators, computed once from already-
  // scanned metadata (filename/directory/exported-symbol tokens) — no file
  // re-reads. Same asymptotic cost as Stage 1 scoring itself (O(files x
  // task terms)), so this adds no meaningful overhead.
  const profilesByPath = new Map<string, FileTermProfile>(
    eligibleFiles.map((f) => [f.path, buildFileProfile(f)]),
  );
  const termMatchCounts = new Map<string, number>();
  for (const token of tokens) {
    let count = 0;
    for (const profile of profilesByPath.values()) {
      if (anyTokenRelates([token], profile.all)) count++;
    }
    termMatchCounts.set(token, count);
  }
  const basenameCounts = new Map<string, number>();
  for (const file of eligibleFiles) {
    const basename = file.path.split('/').pop() ?? '';
    basenameCounts.set(basename, (basenameCounts.get(basename) ?? 0) + 1);
  }

  const scoreByPath = new Map<string, RankingReason[]>();
  for (const file of eligibleFiles) {
    const { reasons } = scoreLexical(
      file,
      tokens,
      phraseTokens,
      workspaceTokensByPath,
      termMatchCounts,
      basenameCounts,
      eligibleFiles.length,
    );
    if (reasons.length > 0) scoreByPath.set(file.path, reasons);
  }

  // Entry-point relevance: a modest boost, and only ever for the *source*
  // counterpart of an entry point — a generated dist/build file is never a
  // valid recommendation, mapped or not.
  for (const entry of snapshot.entryPoints) {
    const candidatePath = entry.sourcePath ?? entry.path;
    if (
      candidatePath === entry.path &&
      /(^|\/)(dist|build|coverage|\.next|out)\//.test(entry.path)
    ) {
      continue;
    }
    if (scoreByPath.has(candidatePath)) {
      const reasons = scoreByPath.get(candidatePath);
      if (reasons && !reasons.some((r) => r.kind === 'entry-point')) {
        addReason(
          reasons,
          'entry-point',
          RANKING_WEIGHTS.entryPoint,
          `is a ${entry.kind} entry point`,
        );
      }
    }
  }

  const allPaths = new Set(snapshot.files.map((f) => f.path));

  // --- Stage 2: bounded import-graph + test-counterpart expansion -------
  const rankedSeeds = [...scoreByPath.entries()]
    .map(([path, reasons]) => ({ path, score: reasons.reduce((sum, r) => sum + r.weight, 0) }))
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  const seeds = rankedSeeds.slice(0, MAX_SEEDS).map((s) => s.path);

  const forward = new Map<string, string[]>();
  const reverse = new Map<string, string[]>();
  for (const edge of snapshot.internalEdges) {
    if (edge.kind !== 'import') continue;
    if (!forward.has(edge.from)) forward.set(edge.from, []);
    forward.get(edge.from)?.push(edge.to);
    if (!reverse.has(edge.to)) reverse.set(edge.to, []);
    reverse.get(edge.to)?.push(edge.from);
  }

  let graphNodesVisited = 0;
  const visitedAtDepth = new Map<string, number>();
  let frontier = new Set(seeds);
  for (const seed of seeds) visitedAtDepth.set(seed, 0);

  for (let depth = 1; depth <= MAX_GRAPH_DEPTH; depth++) {
    const nextFrontier = new Set<string>();
    for (const path of frontier) {
      if (graphNodesVisited >= MAX_GRAPH_NODES_VISITED) break;
      const outDegree = forward.get(path)?.length ?? 0;
      const inDegree = reverse.get(path)?.length ?? 0;
      if (outDegree + inDegree > MAX_HUB_DEGREE) continue;
      const neighbors = [...(forward.get(path) ?? []), ...(reverse.get(path) ?? [])];
      for (const neighbor of neighbors) {
        graphNodesVisited++;
        if (graphNodesVisited > MAX_GRAPH_NODES_VISITED) break;
        if (visitedAtDepth.has(neighbor)) continue;
        visitedAtDepth.set(neighbor, depth);
        nextFrontier.add(neighbor);

        const isForward = (forward.get(path) ?? []).includes(neighbor);
        const weight =
          depth === 1
            ? isForward
              ? RANKING_WEIGHTS.importNeighbor
              : RANKING_WEIGHTS.reverseImportNeighbor
            : RANKING_WEIGHTS.secondDegreeNeighbor;
        const kind: RankingReasonKind = isForward ? 'import-neighbor' : 'reverse-import-neighbor';

        if (!allPaths.has(neighbor)) continue;
        const file = eligibleFiles.find((f) => f.path === neighbor);
        if (!file) continue;

        if (!scoreByPath.has(neighbor)) scoreByPath.set(neighbor, []);
        const reasons = scoreByPath.get(neighbor);
        reasons?.push({
          kind,
          weight,
          evidence: `${isForward ? 'imported by' : 'imports'} "${path}" (depth ${depth})`,
        });
      }
    }
    frontier = nextFrontier;
  }

  // --- Test/production counterpart linking -------------------------------
  const currentPaths = [...scoreByPath.keys()];
  for (const path of currentPaths) {
    const file = eligibleFiles.find((f) => f.path === path);
    if (!file) continue;

    if (file.kind !== 'test') {
      const testPath = testCounterpartPath(file, allPaths);
      if (testPath && !isHardExcluded({ ...file, path: testPath, kind: 'test' })) {
        if (!scoreByPath.has(testPath)) scoreByPath.set(testPath, []);
        const reasons = scoreByPath.get(testPath);
        if (reasons && !reasons.some((r) => r.kind === 'test-counterpart')) {
          addReason(
            reasons,
            'test-counterpart',
            RANKING_WEIGHTS.testCounterpart,
            `is the test counterpart of highly-ranked "${path}"`,
          );
        }
      }
    } else {
      const prodPath = productionCounterpartPath(file, allPaths);
      if (prodPath) {
        if (!scoreByPath.has(prodPath)) scoreByPath.set(prodPath, []);
        const reasons = scoreByPath.get(prodPath);
        if (reasons && !reasons.some((r) => r.kind === 'test-counterpart')) {
          addReason(
            reasons,
            'test-counterpart',
            RANKING_WEIGHTS.testCounterpart,
            `is the production counterpart of task-matching test "${path}"`,
          );
        }
      }
    }
  }

  // --- Workspace locality -------------------------------------------------
  // Once Stage 1 has identified the strongest seeds, a file that shares a
  // workspace with one of them is a somewhat better bet than an unrelated
  // file elsewhere in the repo — but only ever as a boost on top of an
  // already-positive candidate, or for that workspace's own config file
  // (which may not have scored yet if the task didn't independently mention
  // a config-relevant term). This never manufactures relevance for a file
  // that has none of its own, and never touches a workspace with no strong
  // seed in it.
  const topSeedScore = rankedSeeds[0]?.score ?? 0;
  const strongSeedMinScore = topSeedScore * STRONG_SEED_RELATIVE_THRESHOLD;
  const strongSeeds = rankedSeeds
    .filter((s) => s.score >= strongSeedMinScore)
    .slice(0, MAX_LOCALITY_SEEDS)
    .map((s) => s.path);
  const strongSeedWorkspaces = new Set(
    strongSeeds
      .map((path) => eligibleFiles.find((f) => f.path === path)?.workspace)
      .filter((w): w is string => Boolean(w)),
  );
  if (strongSeedWorkspaces.size > 0) {
    for (const file of eligibleFiles) {
      if (!file.workspace || !strongSeedWorkspaces.has(file.workspace)) continue;
      if (strongSeeds.includes(file.path)) continue;
      const alreadyPositive = scoreByPath.has(file.path);
      if (!alreadyPositive && file.kind !== 'config') continue;

      if (!scoreByPath.has(file.path)) scoreByPath.set(file.path, []);
      const reasons = scoreByPath.get(file.path);
      if (reasons && !reasons.some((r) => r.kind === 'workspace-locality')) {
        addReason(
          reasons,
          'workspace-locality',
          RANKING_WEIGHTS.workspaceLocality,
          `shares workspace "${file.workspace}" with a strongly-matched file`,
        );
      }
    }
  }

  const files: RankedFile[] = [...scoreByPath.entries()]
    .map(([path, reasons]) => ({
      path,
      score: reasons.reduce((sum, r) => sum + r.weight, 0),
      reasons: [...reasons].sort((a, b) => b.weight - a.weight),
    }))
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

  return {
    tokens,
    files,
    stats: {
      tokenCount: tokens.length,
      filesConsidered: eligibleFiles.length,
      seedCount: seeds.length,
      graphNodesVisited,
      elapsedMs: Date.now() - startedAt,
    },
  };
}

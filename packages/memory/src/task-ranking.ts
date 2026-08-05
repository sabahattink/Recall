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
  | 'config-relevance';

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
} as const;

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

function scoreLexical(
  file: FileRecord,
  taskTokens: string[],
  workspaceTokensByPath: Map<string, string[]>,
): RankingReason[] {
  const reasons: RankingReason[] = [];
  const { filename, directory } = tokenizePath(file.path);

  const filenameMatch = anyTokenRelates(taskTokens, filename);
  if (filenameMatch) {
    const exact = filename.includes(filenameMatch);
    addReason(
      reasons,
      'filename-term',
      exact ? RANKING_WEIGHTS.filenameTermExact : RANKING_WEIGHTS.filenameTermPartial,
      `filename matches task term "${filenameMatch}"`,
    );
  }

  const pathMatch = anyTokenRelates(taskTokens, directory);
  if (pathMatch) {
    const exact = directory.includes(pathMatch);
    addReason(
      reasons,
      'path-term',
      exact ? RANKING_WEIGHTS.pathTermExact : RANKING_WEIGHTS.pathTermPartial,
      `path segment matches task term "${pathMatch}"`,
    );
  }

  if (file.workspace) {
    const workspaceTokens = workspaceTokensByPath.get(file.workspace) ?? [];
    const workspaceMatch = anyTokenRelates(taskTokens, workspaceTokens);
    if (workspaceMatch) {
      addReason(
        reasons,
        'workspace-match',
        RANKING_WEIGHTS.workspaceMatch,
        `workspace "${file.workspace}" matches task term "${workspaceMatch}"`,
      );
    }
  }

  if (file.kind === 'config' && taskTokens.some((token) => CONFIG_RELEVANT_TERMS.has(token))) {
    addReason(
      reasons,
      'config-relevance',
      RANKING_WEIGHTS.configRelevance,
      'task mentions tooling/build/CI-relevant terms and this is a configuration file',
    );
  }

  // A lockfile that survived isConditionallyExcluded (i.e. the task is
  // dependency-related) is relevant precisely *because* the task is
  // dependency-related — score it the same way a matching config file
  // would be, rather than leaving it at a scoreless zero.
  const basename = file.path.split('/').pop() ?? '';
  if (LOCKFILE_NAMES.has(basename)) {
    const term = taskTokens.find((token) => DEPENDENCY_RELEVANT_TERMS.has(token));
    if (term) {
      addReason(
        reasons,
        'config-relevance',
        RANKING_WEIGHTS.configRelevance,
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
      addReason(
        reasons,
        'symbol-term',
        RANKING_WEIGHTS.symbolTerm,
        `exports a symbol matching task term "${symbolMatch}"`,
      );
    }
  }

  return reasons;
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

  const workspaceTokensByPath = new Map<string, string[]>(
    snapshot.workspaces.map((w) => [w.path, splitWords(w.name)]),
  );

  const eligibleFiles = snapshot.files.filter(
    (f) => !isHardExcluded(f) && !isConditionallyExcluded(f, taskTokenSet),
  );

  const scoreByPath = new Map<string, RankingReason[]>();
  for (const file of eligibleFiles) {
    const reasons = scoreLexical(file, tokens, workspaceTokensByPath);
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
  const seeds = [...scoreByPath.entries()]
    .map(([path, reasons]) => ({ path, score: reasons.reduce((sum, r) => sum + r.weight, 0) }))
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, MAX_SEEDS)
    .map((s) => s.path);

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

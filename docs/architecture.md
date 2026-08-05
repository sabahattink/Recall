# Architecture

This document describes how Recall itself is built: package boundaries, the internal data model, and notable engineering decisions. For the format Recall _produces_ in a target repository's `.recall/` directory, see [memory-format.md](memory-format.md).

## Package graph

Recall is a pnpm workspace with the following dependency direction (no cycles):

```
schemas
  ├── git
  ├── analyzers
  └── memory
        │
        ▼
      core  ←── git, analyzers, memory, schemas
        │
        ▼
   apps/cli

test-fixtures  (standalone; consumed as a devDependency by analyzers, memory, core, cli)
```

- **`packages/schemas`** has no internal dependencies. It defines the Zod schemas and inferred TypeScript types for `RepositorySnapshot` and `Manifest`, plus hand-maintained JSON Schema equivalents and a `ManifestMigration` interface for forward-compatible schema evolution.
- **`packages/git`** depends only on `schemas` (for the `GitMetadata` type) and `execa`. It is a thin, read-only wrapper: every method maps to a single `git` invocation with a fixed argument array (never a shell string), scoped with `git -C <cwd>`.
- **`packages/analyzers`** depends only on `schemas`. It performs all deterministic repository analysis and has no knowledge of Git or of `.recall`'s on-disk layout — it takes a repository root (and, optionally, pre-computed Git metadata) and returns a `RepositorySnapshot`.
- **`packages/memory`** depends only on `schemas`. It owns everything related to `.recall/`: manifest and snapshot persistence, Markdown generation with generated-marker preservation, snapshot diffing, staleness detection, and context generation. It is the only package permitted to write files.
- **`packages/core`** depends on `git`, `analyzers`, `memory`, and `schemas`. It contains the seven use cases (`runInit`, `runScanCommand`, `runUpdate`, `runStatus`, `runExplain`, `runContext`, `runDoctor`), the `RecallError` hierarchy with associated exit codes, and the optional `RecallInferenceProvider` interface. It contains no terminal-rendering or argument-parsing code, so it can be reused by a non-CLI frontend without change.
- **`apps/cli`** depends on `core`. It owns command definitions (via `cac`), global option parsing, stdout/stderr discipline, JSON/human rendering, and exit-code propagation.
- **`packages/test-fixtures`** is standalone and provides fixture-project builders (a generic Node.js project, a NestJS project, a Next.js project, and a pnpm monorepo) plus small Git and temp-directory test helpers, consumed as a `devDependency` by the other packages' test suites.

## Internal analysis model

`packages/schemas` defines normalized types rather than passing unstructured objects between packages. The central type is `RepositorySnapshot` (see `packages/schemas/src/repository.ts`), which aggregates:

- repository and Git metadata
- ecosystem metadata (package manager, monorepo status, TypeScript/lockfile presence)
- `WorkspaceInfo[]` (discovered workspace packages and their `dependsOn` relationships)
- `FileRecord[]` (every scanned file, classified by kind and owning workspace)
- `EntryPoint[]`, `DependencyRecord[]`, `InternalDependencyEdge[]`
- `FrameworkDetection[]`, `ConventionFinding[]`, `RiskFinding[]`
- testing, CI, Docker, and service-integration metadata
- `ProjectProfile` — a derived one-line summary (`language`, `applicationType`, `repositoryType`, `frameworks`), e.g. "TypeScript CLI monorepo" for this repository itself. `applicationType` (`cli` | `library` | `web-app` | `api-service` | `unknown`) is a separate axis from `frameworks` — it never substitutes for real framework detection.

`FileRecord.exportedSymbols`, `InternalDependencyEdge.dependencyType` (`runtime` | `development` | `optional` | `peer`), and `EntryPoint.sourcePath` were added after the schema's initial release; all three are optional fields so snapshots from before they existed still parse (see the "Snapshot schema evolution" note below).

Every finding that isn't a plain structural fact carries an `Evidence[]` array (`{ path, line?, reason }`) and, where relevant, a `Confidence` (`"low" | "medium" | "high"`). This is enforced at the type level so a finding can never be added without evidence.

## Task-focused ranking

`recall context --task "<description>"` ranks which files an AI agent should read first for that task. The ranker (`packages/memory/src/task-ranking.ts`) is deterministic, local, and explainable: no embeddings, no AI provider, no network access, and every ranked file carries a human-readable reason built from named, weighted signals (`RANKING_WEIGHTS` in that file is the single source of truth for every weight).

**Tokenization.** The task description is lowercased; punctuation, kebab-case, and snake_case are split as hard boundaries; camelCase/PascalCase transitions are split before that; common stop words (generic verbs like "add"/"fix"/"update", articles, prepositions) are removed; and a conservative, purely _additive_ singular/plural and gerund normalization runs (`controllers` also matches `controller`; `packaging` also matches `package`) — no stemming library, and nothing is ever destructively rewritten, only added to the token set.

**Stage 1 — lexical scoring (metadata only, no file reads).** Every non-excluded file is scored against the task tokens on: filename/path-segment match, exported-symbol match (using `FileRecord.exportedSymbols`, already extracted once at scan time — see below), owning-workspace name match, and configuration relevance (only when the task itself implies tooling/build/lint/test/CI/release work, and weighted low enough that it can never bury a real filename/symbol/graph match). Hard exclusions (`generated`-kind files, `node_modules`, `.recall`, binaries, minified files) and conditional exclusions (test fixtures unless the task mentions fixtures/tests; lockfiles unless the task is dependency-related) are applied before scoring.

**Stage 2 — bounded graph expansion.** The strongest Stage 1 files (capped at 15) become seeds. Their import-graph neighbors — direct and reverse, via `InternalDependencyEdge`, up to depth 2 — get a smaller boost, and each production/test counterpart of an already-ranked file is linked in both directions. Traversal is bounded on every axis (max seeds, max depth, max total nodes visited) so ranking time never scales with total repository size, and any node whose combined edge count exceeds a hub-degree threshold is never used as a further expansion source — otherwise a widely-imported shared package (this repository's own `packages/schemas` is exactly such a node) would pull in an effectively-random slice of the whole repository at depth 2.

Ties are broken by ascending normalized (`/`-separated) path, so output is byte-identical across repeated runs and operating systems. The default result limit is 10 files (kept in the 8–12 range); `RankedFile.reasons` (kind, weight, evidence) is available in full via `recall context --task ... --json`, while Markdown output shows only the single strongest reason per file, in plain language, never a raw score.

### Precision signals (term specificity, density, locality)

Sprint 2.1 addressed a concrete precision gap: a task like "fix the Windows npm packaging shebang" was crowded out by every `package.json` in the repository, because the term "packaging" stems (additively) to "package", which trivially matches nearly every workspace's manifest and even the top-level `packages/` path segment. Four additional, still purely local and deterministic, signals fix this without introducing any semantic understanding:

- **Term specificity** (`termWeightMultiplier` in `task-ranking.ts`) — an inverse-document-frequency-style multiplier: `specificity(term) = clamp(lerp(log((N+1)/(matches+1)) / log(N+1)), [0.25, 2.5])`, where `N` is the count of eligible files and `matches` is how many of them the term relates to. A term matching almost every file (like "package" in this monorepo) is heavily dampened; a term matching only one or two files (like "shebang") is amplified — but the multiplier is clamped so a generic term still contributes something, never zero. Computed once per ranking call from already-scanned filename/path/exported-symbol metadata — no extra file reads, same asymptotic cost as Stage 1 scoring itself.
- **Generic ecosystem terms** — a curated set (`package`, `npm`, `pnpm`, `yarn`, `build`, `test`, `config`, `script`, `file`, `code`, `update`, `fix`, and a few more) gets an additional fixed 0.5x dampening on top of data-driven specificity. This is deliberately curated, not learned, and deliberately excludes every domain/product term the tokenizer is designed to preserve (`password`, `reset`, `controller`, `queue`, `redis`, `context`, `ranking`, `shebang`, `bundle`, `auth`, `service`, ...) — matching one of those still counts at full strength.
- **Basename specificity** — a second, gentler multiplier (floor 0.35, vs. 0.25 for term specificity) applied only to the filename-term signal, based on how many eligible files share the exact same basename. A repository with a `package.json` in every workspace dampens each one's filename match independently of whatever term matched — this is basename repetition, a different phenomenon from term genericness, so it is scored separately.
- **Multi-term density** (`multi-term-density` reason) — a file that independently matches two or more _distinct_ task-term concepts is real evidence a single generic word is not. "Distinct" is computed by collapsing the tokenizer's own additive stem/gerund variants of one word (`packag`/`package`/`packaging` are one concept, not three) via the same containment relation used for matching, so this can never be gamed by the tokenizer's own normalization. A same-word match found twice (e.g. by both the filename and an exported symbol) does not count twice. An extra bonus applies when two matched terms are also adjacent to each other in the task phrase as written (e.g. "packaging shebang") — still plain containment matching, never fuzzy. The file-kind-wide config-relevance signal (which fires identically for every config file once the task mentions any CI/build/package term) is deliberately excluded from this count, since it is not evidence about _this specific file_.
- **Workspace locality** (`workspace-locality` reason) — once Stage 1 (plus the signals above) identifies a genuinely strong seed (score at or above 40% of the single best seed's score, not just top-N by rank — rank alone would let a sea of near-tied generic matches crown an arbitrary "strong" seed via path tie-breaking), files sharing that seed's workspace get a modest, bounded boost. Applied only on top of an already-positive score, or to that workspace's own config file directly — it can never manufacture relevance for an unrelated file, and a workspace with no strong seed in it is never touched.

None of this amounts to semantic understanding: every signal above is still exact/containment string matching over metadata already captured at scan time, just with better-calibrated weights.

## Notable engineering decisions

- **Import graph via regular expression, not `ts-morph`.** `packages/analyzers/src/import-graph.ts` extracts `import`/`export`/`require` specifiers with a regular expression rather than a full AST parse. Import specifiers are string literals with a narrow grammar, so a regex is deterministic and fast across thousands of files without the overhead of building a `ts-morph` `Project` (which would also require type-checking configuration Recall has no business depending on, since it never executes or type-checks the target repository). `ts-morph` remains available as a dependency choice for a future feature where AST-level analysis would materially improve correctness (e.g., resolving re-exports through barrel files) — see [roadmap.md](roadmap.md). The same read pass also extracts each file's top-level exported symbol names (also via regex) into `FileRecord.exportedSymbols`, so task-focused ranking's symbol-match signal never needs to re-read source files at context-generation time.
- **NodeNext-style specifiers are mapped back to source.** This codebase (like most modern TypeScript/ESM projects) writes relative imports with the compiled extension — `import { x } from './y.js'` even though only `y.ts` exists on disk. `resolveRelativeImport` tries the specifier as-is first, then maps common compiled extensions (`.js`, `.jsx`, `.mjs`, `.cjs`) back to their likely source extension(s) (`.ts`/`.tsx`, `.mts`, `.cts`) before giving up. Without this, same-package relative imports — the most common and most semantically meaningful edges — would almost never resolve.
- **Snapshot diffing without content hashing.** `packages/memory/src/diff.ts` detects "changed" files by comparing file size between two snapshots rather than hashing file contents. This is a deliberate, documented trade-off: it can miss same-size content edits, but avoids reading full file contents for every scan (see Performance below) and keeps the snapshot format free of file digests that would otherwise need to be recomputed and stored for every file on every scan.
- **Token estimation is a fixed heuristic, not a model-specific tokenizer.** `packages/memory/src/token-estimate.ts` estimates ~4 characters per token. This is documented as approximate and is deterministic, so `recall context --max-tokens` behaves consistently across machines without depending on a specific vendor's tokenizer package.
- **`.recall/cache/` is the only gitignored path.** Everything else under `.recall/` (manifest, snapshots, generated Markdown) is designed to be committed, so project memory travels with the code.
- **Snapshot schema evolution without a version bump.** `exportedSymbols`, `dependencyType`, `sourcePath`, and `projectProfile` were all added as `.optional()` Zod fields on the existing `schemaVersion: "1.0.0"` snapshot schema, rather than bumping the schema version. A snapshot written before these fields existed still parses successfully (the fields are simply absent); `recall update`/`recall init` populate them on the next run. This avoids the alternative — a version bump plus a migration path — for a published package (`recall-context`) where an old on-disk snapshot must never fail to parse after an upgrade.

## Performance

- File discovery (`packages/analyzers/src/file-walk.ts`) uses `fast-glob`'s streaming API (`fg.stream`, not the array-returning `fg()`) with `followSymbolicLinks: false`, and always excludes `node_modules`, `.git`, `.next`, `dist`, `build`, `coverage`, `.turbo`, `.cache`, `out`, and `vendor`, in addition to respecting `.gitignore` via the `ignore` package.
- Results are capped by `--max-files` (default 20,000). Because discovery streams entries instead of collecting them into an array first, the cap is checked as each entry arrives and the walk stops as soon as it's hit — a scan of a repository with millions of files and `--max-files 100` does not enumerate the other 999,900 first. Hitting the cap sets a `truncated` flag that propagates to the CLI's exit code (`5`, analysis incomplete) rather than silently under-reporting.
- File contents are only read where needed (import-graph extraction, convention detection) and are size-limited (default 2 MB) and binary-detected before being decoded as text.
- Ordering is deterministic (paths are sorted) so two scans of an unchanged repository produce byte-identical snapshots aside from the `generatedAt` timestamp — **when the scan is not truncated**. When it is truncated, the result is still internally sorted, but _which_ files made the cut depends on filesystem enumeration order rather than being guaranteed to be the lexicographically-first `maxFiles` paths. A truncated scan is already flagged as incomplete (exit code `5`), so this narrower guarantee only applies to a case callers are already told not to treat as exhaustive.

## AI-provider architecture

See [provider-interface.md](provider-interface.md). In short: `packages/core` defines the `RecallInferenceProvider` interface and ships only a `NoopInferenceProvider`, which every command uses by default. No command's _correctness_ depends on a provider being configured.

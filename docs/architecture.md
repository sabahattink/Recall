# Architecture

This document describes how Recall itself is built: package boundaries, the internal data model, and notable engineering decisions. For the format Recall *produces* in a target repository's `.recall/` directory, see [memory-format.md](memory-format.md).

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

Every finding that isn't a plain structural fact carries an `Evidence[]` array (`{ path, line?, reason }`) and, where relevant, a `Confidence` (`"low" | "medium" | "high"`). This is enforced at the type level so a finding can never be added without evidence.

## Notable engineering decisions

- **Import graph via regular expression, not `ts-morph`.** `packages/analyzers/src/import-graph.ts` extracts `import`/`export`/`require` specifiers with a regular expression rather than a full AST parse. Import specifiers are string literals with a narrow grammar, so a regex is deterministic and fast across thousands of files without the overhead of building a `ts-morph` `Project` (which would also require type-checking configuration Recall has no business depending on, since it never executes or type-checks the target repository). `ts-morph` remains available as a dependency choice for a future feature where AST-level analysis would materially improve correctness (e.g., resolving re-exports through barrel files) — see [roadmap.md](roadmap.md).
- **Snapshot diffing without content hashing.** `packages/memory/src/diff.ts` detects "changed" files by comparing file size between two snapshots rather than hashing file contents. This is a deliberate, documented trade-off: it can miss same-size content edits, but avoids reading full file contents for every scan (see Performance below) and keeps the snapshot format free of file digests that would otherwise need to be recomputed and stored for every file on every scan.
- **Token estimation is a fixed heuristic, not a model-specific tokenizer.** `packages/memory/src/token-estimate.ts` estimates ~4 characters per token. This is documented as approximate and is deterministic, so `recall context --max-tokens` behaves consistently across machines without depending on a specific vendor's tokenizer package.
- **`.recall/cache/` is the only gitignored path.** Everything else under `.recall/` (manifest, snapshots, generated Markdown) is designed to be committed, so project memory travels with the code.

## Performance

- File discovery (`packages/analyzers/src/file-walk.ts`) uses `fast-glob` with `followSymbolicLinks: false` and always excludes `node_modules`, `.git`, `.next`, `dist`, `build`, `coverage`, `.turbo`, `.cache`, `out`, and `vendor`, in addition to respecting `.gitignore` via the `ignore` package.
- Results are capped by `--max-files` (default 20,000); hitting the cap sets a `truncated` flag that propagates to the CLI's exit code (`5`, analysis incomplete) rather than silently under-reporting.
- File contents are only read where needed (import-graph extraction, convention detection) and are size-limited (default 2 MB) and binary-detected before being decoded as text.
- Ordering is deterministic (paths are sorted) so two scans of an unchanged repository produce byte-identical snapshots aside from the `generatedAt` timestamp.

## AI-provider architecture

See [provider-interface.md](provider-interface.md). In short: `packages/core` defines the `RecallInferenceProvider` interface and ships only a `NoopInferenceProvider`, which every command uses by default. No command's *correctness* depends on a provider being configured.

# Roadmap

This document tracks what is deliberately out of scope for the current release and what's planned next. It is not a commitment to a timeline.

## Release status

The current published CLI is **0.2.1**. Commands, output format, and internals may still change in future releases. It is a self-contained bundle — the internal `@recall-ai/*` workspace packages are private and never published — so `npm install recall-context` (or `npm install -g recall-context`) needs nothing beyond what's declared in its own `dependencies`. See the [README's quick start](../README.md#quick-start) for installation.

The repository targets `main` as its permanent default branch: `.github/workflows/ci.yml`, `release.yml`, and `.changeset/config.json` all target `main` only.

## Current release (MVP)

Supported: TypeScript/JavaScript repositories, pnpm/npm/Yarn projects, monorepos, Git repositories, NestJS, Next.js, and generic Node.js projects. All seven commands (`init`, `scan`, `update`, `status`, `explain`, `context`, `doctor`) are implemented and tested against fixtures for each supported project shape.

## Deliberately deferred

In order of what was deprioritized when scope had to be controlled:

1. **Paid AI-provider integrations.** The `RecallInferenceProvider` interface and `NoopInferenceProvider` are implemented; OpenAI/Anthropic/Ollama adapters are not (see [provider-interface.md](provider-interface.md)).
2. **Advanced semantic code analysis.** The import graph is built from regular-expression extraction of import/require specifiers, not a full AST/type-checked analysis (e.g. via `ts-morph`). This means resolution of dynamic imports, complex re-export chains, and path-mapped aliases beyond `tsconfig.json`'s `compilerOptions.paths` field is not attempted.
3. **VS Code and MCP integrations.** Recall is a CLI only in this release; editor extensions and a Model Context Protocol server are not implemented.
4. **Additional language ecosystems.** The analyzer layer (`packages/analyzers`) is structured so a new language/ecosystem detector can be added without touching `packages/core` or `apps/cli`, but only the Node.js/TypeScript ecosystem is implemented today.
5. **Snapshot history beyond "latest".** `.recall/snapshots/` currently stores only `latest.json`; there is no historical snapshot archive to diff against arbitrary past points (`recall update --since <ref>` uses Git history for this instead of stored snapshots).
6. **Backup pruning.** `.recall/backups/` accumulates timestamped backups before every overwrite; there is no automatic pruning or retention policy yet.
7. **Content-hash-based change detection.** `recall update`'s file-changed detection compares file size between snapshots rather than hashing content, so a same-size edit may not be flagged as "changed" (additions/removals of files are always detected).

## Current hardening phase

Phase 0 focuses on correctness and noise before deeper code intelligence lands: broader/correct Next.js route detection, configurable feature/glossary/risk analysis scope, source-aware and deduplicated entry points, lower-noise glossary output, production-only deep-coupling risk counts, and packaging tests that do not hang when the npm registry is unavailable.

This phase deliberately does **not** change the snapshot schema. Existing `1.0.0` snapshots remain readable.

## Planned next

The product direction is evidence-anchored, staleness-aware repository memory that agents can read and write over MCP while remaining deterministic and local-first. The next implementation phases are:

1. Parser-backed TypeScript/JavaScript code intelligence with content hashes, symbol anchors, a file dependency graph, test/source mapping, bounded Git co-change data, and incremental cache.
2. Task ranking v2 using symbol/path/graph/centrality/co-change/test signals with explicit explanations and context budgets/formats.
3. A deterministic evaluation harness with pinned OSS repositories and recall@5/recall@10/MRR baselines before ranking improvements are claimed.
4. `recall mcp` as the primary agent-facing distribution surface.
5. Evidence-anchored writable memory with freshness/stale/orphaned verification.
6. Agent sync and freshness hooks for common coding-agent instruction files and CI.

Additional language ecosystems, LLM providers, editor extensions, and website work remain out of scope for these phases.

## Contributing to the roadmap

Open an issue to propose a new item or to pick up one of the above. See [CONTRIBUTING.md](../CONTRIBUTING.md).

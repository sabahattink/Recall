# Changelog

Release notes for the published `recall-context` npm package. Internal `@recall-ai/*` workspace packages are never published and are not tracked here.

## 1.0.0 (unreleased)

Recall v1 implements [the product specification](docs/product-specification.md): one command that initializes a repository's memory for AI coding assistants.

### Highlights

- `npx recall-context init` writes `.recall/memory.json` and one file each for Claude Code, Codex, Cursor, Gemini CLI, and ChatGPT/OpenAI.
- Every entry in `memory.json` cites the file that proves it; every agent file is rendered from `memory.json` alone.
- Offline, read-only, all-or-nothing, and byte-identical on every machine — verified in CI on Linux, macOS, and Windows.
- Python, Go, and Rust repositories; more JavaScript frameworks, package managers, and lint/format tools.

### Breaking

- The CLI is now exactly `recall init [path] [--force]`. `scan`, `update`, `status`, `explain`, `context`, and `doctor` are removed.
- The v0.2 `.recall/` layout (`manifest.json`, `snapshots/`, `architecture.md`, …) is replaced. Run `recall init --force` once to regenerate it.
- Exit codes: 0 success, 1 unexpected failure, 2 invalid usage, 3 invalid path, 4 already initialized, 5 unsafe output location.

## 0.2.0

### Highlights

- Deterministic task-focused context ranking
- Explainable ranking evidence in JSON
- Better source entry-point detection
- Runtime and development dependency-edge classification
- TypeScript CLI monorepo project profiling
- Ranking specificity improvements for generic terms

### Example

```bash
recall context --task "Fix password reset controller" --stdout
```

### Compatibility

- Existing snapshots remain readable.
- New snapshot fields are additive and optional.
- Running `recall update` refreshes older snapshots with richer metadata.

### Release note

Ranking weights are heuristic. Generated output and JSON fields may evolve in future releases; this release makes no unsupported performance or accuracy claims.

## 0.1.0

Initial public alpha.

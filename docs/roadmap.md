# Roadmap

This document tracks what is deliberately out of scope for the current release and what's planned next. It is not a commitment to a timeline.

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

## Planned next

- A content-hash option for more precise change detection in `recall update`, opt-in given the added I/O cost.
- Broader framework detection within the Node.js ecosystem (e.g. Remix, NestJS microservices patterns, tRPC).
- A documented extension point for additional risk rules without modifying `packages/analyzers` core.

## Contributing to the roadmap

Open an issue to propose a new item or to pick up one of the above. See [CONTRIBUTING.md](../CONTRIBUTING.md).

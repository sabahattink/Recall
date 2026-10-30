# Roadmap

Recall v1 is deliberately small: one command that initializes a repository's memory for AI coding assistants (see [product-specification.md](product-specification.md)). This page records what v1 contains, its known limits, and what is permanently outside its scope.

## v1

- `recall init [path] [--force]` — the entire public surface.
- `.recall/memory.json` plus five agent files: Claude Code, Codex, Cursor, Gemini CLI, ChatGPT/OpenAI.
- Detection for TypeScript/JavaScript, Python, Go, and Rust repositories; single packages and `workspaces`/`pnpm-workspace.yaml` monorepos.
- Deterministic, idempotent, offline, all-or-nothing — verified on Linux, macOS, and Windows in CI.

The task breakdown behind v1 is in [implementation-blueprint.md](implementation-blueprint.md). Its Milestones 1–4 are implemented; Milestone 5's publishing steps (npm release, GitHub Release, post-publish smoke test) are a maintainer's release action, not code.

## Known limits of v1

These are boundaries of the current detectors, not bugs. Each one errs toward saying nothing rather than guessing.

- **Commands** are read from the root `package.json` only; per-workspace scripts and non-JavaScript task runners (Makefiles, `justfile`, Poetry scripts, Cargo aliases) are not reported.
- **Dependencies** are read from `package.json` files only; `pyproject.toml`, `requirements.txt`, `go.mod`, and `Cargo.toml` dependency lists are not extracted yet.
- **Frameworks** are detected for the JavaScript ecosystem only.
- **Workspace members** are every `package.json` below a workspace root, not matched against the declared globs; a package deliberately excluded from the globs is still listed.
- **`.gitignore`** is read from the repository root only; nested `.gitignore` files are not applied.
- **The walk stops at 20,000 files**; larger repositories get a `file-limit-reached` risk.

Closing one of these is a change to what the Scanner observes; it changes `memory.json` and is released and documented as such.

## Never in Recall

Per spec §8 and §19, these are not deferred features. They are different products that could be built on top of `.recall/`, and none of them belongs inside Recall: cloud sync, accounts, embeddings, vector databases, RAG, background indexing, MCP integration, realtime updates, team collaboration, prompt history, a chat interface, LLM calls or any AI inference, a database, telemetry, analytics, and remote API calls.

## Proposing a change

Open an issue that answers spec §10's question first: _does this help initialize a repository for AI?_ See [CONTRIBUTING.md](../CONTRIBUTING.md).

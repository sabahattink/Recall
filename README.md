# Recall

**Stop explaining your codebase to AI every new session.**

Recall scans a repository and generates persistent, evidence-backed context that Claude Code, Codex, Gemini CLI, Cursor, and other coding agents can reuse.

[![npm version](https://img.shields.io/npm/v/recall-context.svg)](https://www.npmjs.com/package/recall-context)
[![npm downloads](https://img.shields.io/npm/dm/recall-context.svg)](https://www.npmjs.com/package/recall-context)
[![CI](https://github.com/sabahattink/Recall/actions/workflows/ci.yml/badge.svg)](https://github.com/sabahattink/Recall/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/recall-context.svg)](LICENSE)
[![latest release](https://img.shields.io/github/v/release/sabahattink/Recall?include_prereleases&label=release)](https://github.com/sabahattink/Recall/releases)

> **Alpha.** Recall is an early release. Commands, output format, and internals may still change between versions. See [Current scope](#current-scope) for what's supported today.

## Quick start

```bash
npx recall-context init
```

```bash
npx recall-context context --stdout
```

Or install it once and use the shorter `recall` command:

```bash
npm install -g recall-context
recall init
```

The npm package is `recall-context`; the command it installs is `recall`.

## What it generates

```
.recall/
├── manifest.json       # pointer to the current snapshot + memory files
├── architecture.md      # detected apps/packages/layers, entry points, dependency direction
├── conventions.md       # naming, aliases, linting/formatting, scripts
├── decisions.md         # human-editable decision log
├── features.md          # features backed by structural evidence (controllers, routes, jobs...)
├── glossary.md          # recurring domain terms extracted from identifiers
├── risks.md              # evidence-based risk findings (missing tests, circular deps, etc.)
├── technical-debt.md    # measurable debt findings with evidence and severity
└── snapshots/
    └── latest.json       # the deterministic scan result everything above is derived from
```

Every generated file wraps Recall's content in markers; anything you write outside them is yours and survives every `recall update`.

## Before / after

**Before**, every new AI session:

```
New session → explain architecture → explain conventions → explain important files → repeat next session
```

**After**:

```bash
recall context --stdout
```

Paste or pipe the output into your coding agent.

## Recall vs CLAUDE.md / AGENTS.md

|                     | `CLAUDE.md` / `AGENTS.md`     | Recall                                             |
| ------------------- | ----------------------------- | -------------------------------------------------- |
| Authored by         | A human, by hand              | Derived from repository evidence                   |
| Stays current?      | Can go stale silently         | Detects and reports staleness (`recall status`)    |
| Shape               | Typically one static document | Snapshot + multiple focused files                  |
| Scans the repo?     | No                            | Yes — deterministic, local scan                    |
| Evidence paths      | Not by default                | Every claim traces back to source                  |
| Works across agents | Depends on the file           | Same output for any agent that reads Markdown/JSON |

Recall doesn't replace `CLAUDE.md` or `AGENTS.md`. Use `CLAUDE.md`/`AGENTS.md` for human-authored instructions — things only a person should decide. Use Recall for generated repository context and freshness checks — things that can be derived and kept honest automatically. Most projects will want both.

## Commands

```bash
recall init                                  # analyze the repository and create .recall/
recall scan                                   # re-run deterministic analysis, save a snapshot
recall update                                 # refresh memory from the current repository state
recall status                                 # check whether memory is initialized and up to date
recall explain <path>                         # explain a file or directory's role
recall context                                # generate compact, agent-ready context
recall context --task "Add password reset"    # focus that context on a specific task
recall doctor                                 # validate the environment and memory state
```

See [docs/cli-reference.md](docs/cli-reference.md) for every flag and exit code.

## Safety

- Local-first: everything runs on your machine, in your repository.
- No account, sign-up, or API key required.
- No telemetry.
- No AI provider is required or called by default (see [docs/provider-interface.md](docs/provider-interface.md)).
- Does not execute, import, or evaluate your project's source code or scripts.
- Managed writes are restricted to `.recall/`, `.gitignore`, and any output path you explicitly pass.
- Refuses to write through a symlinked `.recall` directory or a symlink escape anywhere in the write path.
- Generated Markdown preserves human-authored content outside its `<!-- recall:generated:* -->` markers.

## Current scope

**Supported now:** JavaScript, TypeScript, Node.js, NestJS, Next.js, pnpm/npm/Yarn, monorepos, both Git and non-Git repositories.

**Not yet built:** an MCP server, additional language ecosystems, deeper semantic (AST-based) analysis, an optional AI-assisted "why" layer, editor integrations. See [docs/roadmap.md](docs/roadmap.md) for the full list and what's deliberately deferred.

## Demo

A 20–30 second terminal recording is planned but not yet produced — see [docs/demo-script.md](docs/demo-script.md) for the exact script and [docs/assets/](docs/assets/) for where the recording will live once made.

## Learn more

- [CLI reference](docs/cli-reference.md) — every command, flag, and exit code
- [Memory format](docs/memory-format.md) — the on-disk `.recall/` format
- [Architecture](docs/architecture.md) — how the monorepo is structured
- [Roadmap](docs/roadmap.md) — what's in scope, deferred, and planned
- [Changelog](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [npm package](https://www.npmjs.com/package/recall-context)
- [Releases](https://github.com/sabahattink/Recall/releases)
- [Issues](https://github.com/sabahattink/Recall/issues)

## A note on the name

Recall's longer-term vision includes tracking _why_ decisions were made, not just what the code currently looks like. That's a future direction, not a current capability — today `decisions.md` records only what's structurally evidenced plus whatever a human writes into it by hand.

## License

[MIT](LICENSE)

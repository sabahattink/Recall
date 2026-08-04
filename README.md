# Recall

**Persistent, evidence-backed codebase context for AI coding agents.**

Every time an AI coding agent opens a new session against a repository, it starts from zero: it has to re-read the codebase, re-derive the architecture, re-guess the conventions, and re-discover the risks — burning tokens and time on rediscovery instead of on the actual task. That rediscovery is also inconsistent: different sessions can draw different conclusions about the same codebase, and none of it is checked into version control where a team can see, correct, or rely on it. Recall runs a deterministic, local scan of your repository and turns the result into structured, evidence-backed Markdown and JSON under `.recall/` — a versioned artifact any agent or tool can read, and that Recall itself can tell you is stale when the code moves on without it.

## Quick start

> **Registry installation is pending.** `recall-context` has not been published to npm yet. `npx recall-context init` is the intended one-command install once it is; until then, use the [from-source / tarball instructions](#installation) below.

```bash
npx recall-context init
```

## The problem, and what Recall is not

Recall is not a code generator, not an AI provider, and not a substitute for `CLAUDE.md`/`AGENTS.md` — see [Recall vs CLAUDE.md / AGENTS.md](#recall-vs-claudemd--agentsmd) below for how it relates to those. It is a local, deterministic scanner that produces a factual snapshot of what your repository actually contains — frameworks, workspaces, entry points, conventions, risks — with every claim traceable back to the file(s) that support it.

## Installation

Recall requires Node.js 22+. No account, API key, or network access is required to run it.

### From the registry (planned, not yet available)

```bash
# NOT YET PUBLISHED — shown for the intended future shape only.
npx recall-context init
npm install -g recall-context
```

Do not expect these commands to work yet. See [docs/roadmap.md](docs/roadmap.md#release-status) for what's left before they do.

### From source (current development state)

```bash
git clone https://github.com/sabahattink/Recall.git
cd Recall
pnpm install
pnpm build

# Run directly:
node apps/cli/dist/index.js init

# Or link a local `recall` command onto your PATH:
cd apps/cli && pnpm link --global
recall init
```

### From a packed tarball (tests the actual npm package, current development state)

This is the closest thing to `npx recall-context init` available before the real npm publish — it builds and packs the real `recall-context` package and installs it like any consumer would, with no workspace resolution involved:

```bash
cd apps/cli
npm pack                       # builds, bundles, and packs recall-context-<version>.tgz

mkdir /tmp/recall-try && cd /tmp/recall-try
npm init -y
npm install /path/to/Recall/apps/cli/recall-context-<version>.tgz

npx recall init
```

## Demo

```bash
$ cd my-project
$ recall init
Recall initialized in 0.3s

Detected:
  Framework: NestJS
  Package manager: pnpm
  Workspaces: 3
  Entry points: 4

Generated:
  .recall/architecture.md
  .recall/conventions.md
  .recall/decisions.md
  + 4 more files

Next:
  recall context --stdout
  recall context --task "Describe your task"

$ recall status
Status: ok
Project type: nestjs
Last snapshot commit: 4f2a9c1
Current commit: 4f2a9c1
Current branch: main

$ recall context --stdout --task "Add Paddle webhook verification"
# Recall Context: my-project
...
```

(Output above is a real, unedited `recall init` run against one of this repository's own test fixtures — see [apps/cli/src/commands/init.ts](apps/cli/src/commands/init.ts) for how it's derived from what was actually detected.)

## Recall vs CLAUDE.md / AGENTS.md

`CLAUDE.md` and `AGENTS.md` are **manually maintained instructions**: a human writes down what they want an agent to know or do, and it stays exactly as written until someone edits it again. Nothing checks whether it still matches the codebase.

Recall **derives** its context from the repository itself — frameworks, workspaces, entry points, conventions, and risks are all extracted by deterministic analysis, not typed by hand — and can detect when that derived context has gone stale (`recall status`, `recall update --check`) because the repository changed underneath it. The two are complementary, not competing: `CLAUDE.md`/`AGENTS.md` are a good place for intent and instructions a human wants to state explicitly; Recall is a good place for the factual, evidence-backed picture of what the code currently is. Many projects will want both.

## Quick reference

```bash
recall init        # analyze the repository and create .recall/
recall status       # check whether memory is initialized and up to date
recall scan          # re-run deterministic analysis, save a snapshot
recall update        # refresh memory from the current repository state
recall explain src/auth/auth.service.ts   # explain a file or directory
recall context --stdout                    # print compact context for an agent
recall doctor        # validate the environment and memory state
```

## Generated file example

`recall init` creates a `.recall/` directory:

```
.recall/
├── manifest.json       # versioned pointer to the current snapshot + memory files
├── architecture.md      # detected apps/packages/layers, entry points, dependency direction
├── conventions.md       # naming, aliases, linting/formatting, scripts — all evidence-backed
├── decisions.md         # human-editable ADR log + unconfirmed candidate decisions
├── features.md          # features backed by strong structural evidence (controllers, routes, jobs...)
├── glossary.md          # recurring domain terms extracted from identifiers, left unresolved
├── risks.md              # evidence-based risk findings (missing tests, circular deps, etc.)
├── technical-debt.md    # measurable debt findings with evidence and severity
├── schema/               # standalone JSON Schemas for manifest.json and snapshots
└── snapshots/
    └── latest.json       # normalized RepositorySnapshot: the deterministic analysis Recall generated
```

Every Markdown file wraps Recall's generated content in explicit markers:

```markdown
<!-- recall:generated:start -->

...content Recall regenerates on every `recall update`...
<!-- recall:generated:end -->

## Notes

Anything you write here is yours. Recall never touches it.
```

## Commands

| Command                         | Purpose                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------- |
| `recall init`                   | Create or refresh `.recall/` for the current repository                          |
| `recall scan`                   | Run deterministic analysis and save a snapshot                                   |
| `recall update`                 | Compare against the last snapshot and refresh memory (supports `--check` for CI) |
| `recall status`                 | Show initialization, staleness, and memory health                                |
| `recall explain <path>`         | Explain a file/directory's role using deterministic evidence                     |
| `recall context [--task "..."]` | Generate compact, agent-ready context                                            |
| `recall doctor`                 | Validate the runtime, Git, and memory state                                      |

Global options: `--path <dir>`, `--json`, `--quiet`, `--verbose`, `--no-color`. See [docs/cli-reference.md](docs/cli-reference.md) for the full reference, including every command's flags and exit codes.

## Local-first

- No account, sign-up, or API key required.
- No hosted service or database — everything runs on your machine, in your repository.
- No network access is required to run any Recall command.
- Output is plain JSON and Markdown files under your repository's `.recall/` directory: readable in any editor, diffable in any Git client, and greppable by any tool.
- `.recall/` is designed to be committed to your repository (only `.recall/cache/` is gitignored), so memory travels with the code and is versioned alongside it.

## What Recall does not do

- It does not require or call any AI provider. The default `NoopInferenceProvider` does nothing, and every command produces complete, correct output without it (see [docs/provider-interface.md](docs/provider-interface.md)).
- It does not run, import, or evaluate your project's source code or scripts.
- It is not a security scanner. `risks.md` surfaces a small set of deterministic, evidence-based findings — it is not a substitute for dedicated security tooling (see [SECURITY.md](SECURITY.md)).
- It does not fabricate architectural decisions, business intent, or definitions it cannot support with evidence — unresolved or unconfirmed items are labeled as such.
- It does not modify your source files. Writes are restricted to `.recall/`, `.gitignore`, and any output path you explicitly pass.
- It does not (yet) measure or claim token savings, speed improvements, or agent-accuracy gains — those would need real measurement, which hasn't been done. What it provides today is a deterministic, evidence-backed alternative to an agent re-deriving repository context from scratch each session.

## A note on the name

Recall's longer-term ambition is to also track _why_ decisions were made, not just _what_ the code currently looks like — a `decisions.md` log that grows richer over time. That's a future direction, not a current capability: today, `decisions.md` records only what's structurally evidenced plus whatever a human writes into it by hand. "Recall remembers why" describes where this is headed, not what it does yet.

## Architecture overview

Recall is a pnpm/Turborepo monorepo:

- **`apps/cli`** (published as the `recall-context` npm package) — command definitions, argument parsing, terminal rendering, exit codes. Bundled into a single self-contained `dist/index.js` for publishing; the internal `@recall-ai/*` packages below are private and never published separately.
- **`packages/core`** — application use cases (init/scan/update/status/explain/context/doctor), domain errors, and the optional AI provider interface. No terminal-specific code.
- **`packages/analyzers`** — the deterministic repository scanner: package-manager/framework/workspace detection, import graph, conventions, and risk rules.
- **`packages/git`** — a safe, read-only wrapper around the `git` CLI.
- **`packages/memory`** — manifest and snapshot persistence, Markdown generation with generated-marker preservation, staleness detection, and context generation.
- **`packages/schemas`** — Zod schemas and JSON Schemas for the manifest and snapshot formats, with a versioned migration interface.
- **`packages/test-fixtures`** — fixture project builders (simple Node.js, NestJS, Next.js, pnpm monorepo) shared by the test suites.

See [docs/architecture.md](docs/architecture.md) for details and [docs/memory-format.md](docs/memory-format.md) for the on-disk format.

## Roadmap

See [docs/roadmap.md](docs/roadmap.md) for what's deliberately out of scope for this release and what's planned next.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to set up the repository, run the test suite, and submit changes. Please also review [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) and [SECURITY.md](SECURITY.md) before contributing.

## License

[MIT](LICENSE)

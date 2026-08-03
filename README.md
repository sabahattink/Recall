# Recall

**Git remembers code. Recall remembers why.**

Recall is a local-first, open-source CLI that creates and maintains structured, tool-agnostic project memory for software repositories. It gives AI coding agents (and human contributors) reliable, evidence-based context about a codebase without requiring them to rediscover the entire project during every session.

## The problem

Every time an AI coding agent opens a new session against a repository, it starts from zero: it has to re-read the codebase, re-derive the architecture, re-guess the conventions, and re-discover the risks — burning tokens and time on rediscovery instead of on the actual task. That rediscovery is also inconsistent: different sessions draw different conclusions about the same codebase, and none of it is checked into version control where a team can see, correct, or rely on it.

Recall addresses this by turning repository analysis into a deterministic, versioned, human-readable artifact — `.recall/` — that lives alongside your code, is safe to commit, and any tool (not just one AI vendor) can read.

## Demo

After [installing from source](#installation) and linking the `recall` command:

```bash
$ cd my-project
$ recall init
Initialized Recall memory at /path/to/my-project/.recall
  Wrote: architecture.md, conventions.md, decisions.md, features.md, glossary.md, risks.md, technical-debt.md
  Added .recall/cache/ to .gitignore

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

## Installation

> **Alpha status:** Recall is not yet published to any package registry. `@recall-ai/cli` does not exist on npm, and `@recall-ai` is a **planned, unconfirmed** npm scope — it may change before the first published release. Install from source until a release is published; see [docs/roadmap.md](docs/roadmap.md#release-status) for what's left before that happens.

Recall requires Node.js 22+ and [pnpm](https://pnpm.io) 10+. No account, API key, or network access is required to run it.

### From source (current alpha)

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

### From a package registry (planned, not yet available)

Once published, Recall is intended to be installable the way most Node CLIs are — for example:

```bash
# NOT YET PUBLISHED — shown for the intended future shape only.
pnpm dlx @recall-ai/cli init
npm install -g @recall-ai/cli
```

Do not expect these commands to work yet.

## Quick start

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

## Architecture overview

Recall is a pnpm/Turborepo monorepo:

- **`apps/cli`** — command definitions, argument parsing, terminal rendering, exit codes.
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

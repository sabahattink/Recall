# Contributing to Recall

Thanks for your interest in contributing. Recall initializes a repository's memory for AI coding assistants — one command, offline, deterministic. Three documents govern all work and win over anything here:

- [docs/product-specification.md](docs/product-specification.md) — what Recall is and will never do
- [docs/implementation-blueprint.md](docs/implementation-blueprint.md) — the task breakdown and package ownership
- [docs/engineering-rules.md](docs/engineering-rules.md) — how work is done (no TODOs, no dead code, golden tests for every contract, ...)

## Getting started

Requirements: Node.js 22+, pnpm 10+.

```bash
git clone https://github.com/sabahattink/Recall.git
cd Recall
pnpm install
pnpm build
pnpm test
```

## Repository layout

This is a pnpm workspace managed with Turborepo. See [docs/architecture.md](docs/architecture.md) for package boundaries and responsibilities before adding code — in particular:

- Detection (Facts) lives only in `packages/analyzers`; normalization and every disk write only in `packages/memory`; rendering only in `packages/templates`.
- `packages/core` only sequences the stages; `apps/cli` only parses arguments and prints.
- A new assistant is one template in `packages/templates/src/agents/` plus one registry entry — nothing else changes.

## Development workflow

```bash
pnpm build       # build all packages (Turborepo, cached)
pnpm typecheck   # tsc --noEmit across all packages
pnpm lint        # ESLint across all packages
pnpm test        # Vitest unit/integration/smoke tests across all packages
pnpm format      # Prettier --write
```

Run a single package's tests with `pnpm --filter @recall-ai/<package> test`.

To try the CLI locally against any repository without publishing anything:

```bash
pnpm build
node apps/cli/dist/index.js init path/to/some/repo
```

To run the same end-to-end verification CI runs (builds every reference
fixture in a temporary Git repository, runs the compiled CLI sandboxed with
no network access and writes allowed only inside the repository, and checks
the exact output, that nothing outside `.recall/` changed, the refusal
without `--force`, and byte-identical output across ten runs):

```bash
pnpm build
pnpm verify:cli
```

## Making changes

1. Open an issue first for anything larger than a small fix, so design direction can be agreed on before implementation.
2. Add or update tests for any behavior change. Output contracts have golden files (Scanner facts, each template, each reference fixture's full `.recall/`); regenerate them deliberately with `pnpm --filter <package> exec vitest run -u` and review the diff in your PR.
3. Every Fact carries evidence (`{ path, reason }`). Absence of evidence is absence of a claim — never add a default or a guess.
4. `packages/schemas` is the single source of truth for the Fact and ProjectMemory shapes. A change to `memory.json` or an agent file is a breaking change to a public contract.
5. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` before opening a PR — this mirrors CI.
6. Use [Changesets](https://github.com/changesets/changesets) for any change that should be released: `pnpm changeset`.
7. Write commit messages using [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, etc.).

## Safety invariants

These are non-negotiable for any change:

- Recall writes only `.recall/`, all or nothing, and never through a symlink.
- No network access, no LLM or AI provider, no telemetry.
- Recall never executes the repository's code, scripts, or Git hooks/config-defined commands.
- The same repository state produces byte-identical output on every machine.
- Recall never reads or prints the contents of `.env`-style files.

## Reporting bugs and requesting features

Please use the issue templates in `.github/ISSUE_TEMPLATE/`. Include your OS, Node.js version, and `recall --version`; for an unexpected failure, re-run with `RECALL_DEBUG=1` and include the stack trace.

## Code of Conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to abide by it.

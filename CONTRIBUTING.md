# Contributing to Recall

Thanks for your interest in contributing. Recall is a local-first, deterministic-by-default tool, and contributions should preserve those properties.

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

- Deterministic analysis lives in `packages/analyzers`, not in the CLI or in `packages/core`.
- `packages/core` never imports terminal-rendering code; `apps/cli` never contains analysis logic.
- `packages/memory` is the only package that writes to `.recall/`.

## Development workflow

```bash
pnpm build       # build all packages (Turborepo, cached)
pnpm typecheck   # tsc --noEmit across all packages
pnpm lint        # ESLint across all packages
pnpm test        # Vitest unit/integration/smoke tests across all packages
pnpm format      # Prettier --write
```

Run a single package's tests with `pnpm --filter @recall-ai/<package> test`.

To try the CLI locally against a fixture without publishing anything:

```bash
pnpm build
node apps/cli/dist/index.js init --path packages/test-fixtures/fixtures/simple-node
```

To run the same end-to-end verification CI runs (copies a fixture to a temp
directory, runs `init`/`status`/`context`/`doctor`/`update`, and checks that
human-authored Markdown and source files are untouched):

```bash
pnpm build
pnpm verify:cli
```

## Making changes

1. Open an issue first for anything larger than a small fix, so design direction can be agreed on before implementation.
2. Add or update tests for any behavior change. Direct assertions are preferred over snapshot tests except where the golden file itself is the point (e.g. generated Markdown structure).
3. Every finding Recall reports (a risk, a convention, a feature) must carry evidence (`{ path, reason }`). Do not add inferences without evidence, and do not present a candidate/unconfirmed conclusion as a confirmed fact.
4. Keep `packages/schemas` as the single source of truth for the manifest and snapshot shapes; update both the Zod schema and the JSON Schema together, and bump `schemaVersion` with a migration if the shape changes in a breaking way.
5. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` before opening a PR — this mirrors CI.
6. Use [Changesets](https://github.com/changesets/changesets) for any change that should be released: `pnpm changeset`.
7. Write commit messages using [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, etc.).

## Safety invariants

These are non-negotiable for any change:

- Recall must never modify a user's source files.
- Writes are restricted to `.recall/`, `.gitignore`, and an explicit `--output`/`--path` the user passed.
- Human-authored content outside the `<!-- recall:generated:start/end -->` markers must never be altered or discarded.
- No command may require network access or an AI provider to produce complete output.
- Recall must never print the contents of `.env`-style files.

## Reporting bugs and requesting features

Please use the issue templates in `.github/ISSUE_TEMPLATE/`. Include your OS, Node.js version, package manager, and — for bugs — the output of `recall doctor --verbose` if possible.

## Code of Conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to abide by it.

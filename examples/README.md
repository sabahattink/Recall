# Examples

Real Recall output — nothing here is written by hand.

## This repository

Recall initializes itself. The [`.recall/`](../.recall) directory at the root of this repository is the unedited output of:

```bash
npx recall-context init
```

- [`.recall/memory.json`](../.recall/memory.json) — Project Memory for a nine-workspace pnpm monorepo, with evidence for every entry
- [`.recall/agents/claude.md`](../.recall/agents/claude.md), [`codex.md`](../.recall/agents/codex.md), [`cursor.md`](../.recall/agents/cursor.md), [`gemini.md`](../.recall/agents/gemini.md), [`openai.md`](../.recall/agents/openai.md) — the same memory, rendered for each assistant

It records the commit it was generated from, so it shows its own age; it is regenerated with `recall init --force` when the repository changes enough to matter.

## Reference repositories

The end-to-end golden suite initializes six small reference repositories and commits their complete output. Each directory under [`packages/core/src/__tests__/__golden__/`](../packages/core/src/__tests__/__golden__) holds one fixture's `memory.json` and `agents/`:

| Fixture          | Shape                                                             |
| ---------------- | ----------------------------------------------------------------- |
| `simple-node`    | Single-package Node.js + Express, `node --test`                    |
| `nestjs`         | NestJS API with Jest                                               |
| `nextjs`         | Next.js app router project                                         |
| `pnpm-monorepo`  | pnpm workspace with an app and two packages                       |
| `python-service` | Python service with `pyproject.toml`, Poetry, and pytest-style tests |
| `go-cli`         | Go command-line tool with GitHub Actions CI                        |

The fixtures themselves are defined in [`packages/test-fixtures/src/fixtures/`](../packages/test-fixtures/src/fixtures). Try one locally:

```bash
pnpm build
node apps/cli/dist/index.js init path/to/any/repository
```

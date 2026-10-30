# Recall

**A repository, once initialized, never has to explain itself again.**

Recall initializes a repository's memory for AI coding assistants. Run one command, and every assistant — Claude Code, Codex, Cursor, Gemini CLI, ChatGPT — starts each session already knowing your stack, structure, commands, and conventions, instead of asking you again.

[![npm version](https://img.shields.io/npm/v/recall-context.svg)](https://www.npmjs.com/package/recall-context)
[![CI](https://github.com/sabahattink/Recall/actions/workflows/ci.yml/badge.svg)](https://github.com/sabahattink/Recall/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/recall-context.svg)](LICENSE)

## Quick start

```bash
npx recall-context init
```

```
Scanning repository...
Detecting architecture...
Generating AI memory...
Done.
```

That's it. The repository is initialized.

> The npm package is `recall-context`; it installs the `recall` and `recall-context` commands, which invoke the same CLI. After `npm install -g recall-context`, the same thing is `recall init`.

## Requirements

- Node.js 22 or newer.

## What it creates

```
.recall/
├── memory.json        # Project Memory: the single source of truth
└── agents/
    ├── claude.md      # Claude Code
    ├── codex.md       # OpenAI Codex (AGENTS.md style)
    ├── cursor.md      # Cursor (project-rule front matter)
    ├── gemini.md      # Gemini CLI
    └── openai.md      # ChatGPT / OpenAI API
```

Nothing else, anywhere. `memory.json` holds what Recall found — metadata, technology stack, architecture, structure, commands, conventions, dependencies, and risks — and **every entry cites the file that proves it**:

```json
{
  "name": "test",
  "command": "vitest run",
  "evidence": [{ "path": "package.json", "reason": "scripts.test declared as \"vitest run\"" }]
}
```

Each file in `agents/` is a mechanical rendering of `memory.json` in the format that assistant reads best. No agent file contains anything `memory.json` doesn't.

## Use it with your assistant

| Assistant        | How it picks up its file                                                            |
| ---------------- | ----------------------------------------------------------------------------------- |
| Claude Code      | Add `@.recall/agents/claude.md` to your `CLAUDE.md`                                 |
| Gemini CLI       | Add `@.recall/agents/gemini.md` to your `GEMINI.md`                                 |
| Codex            | Copy `.recall/agents/codex.md` to `AGENTS.md` (or reference it from there)          |
| Cursor           | Copy `.recall/agents/cursor.md` to `.cursor/rules/recall.mdc` — it's always applied |
| ChatGPT / OpenAI | Paste `.recall/agents/openai.md` into a Project's instructions or a system prompt   |

Recall complements a hand-written `CLAUDE.md` or `AGENTS.md`, it doesn't replace it: keep writing the things only a person can decide there, and let Recall supply what can be read straight off the repository.

## Guarantees

- **No network access.** Everything happens offline, on your machine.
- **No code execution.** Recall reads files; it never runs your code, tests, or scripts.
- **Writes only `.recall/`.** No other file in your repository is touched.
- **All or nothing.** Either the complete `.recall/` is written, or nothing is.
- **Deterministic.** The same repository state produces byte-identical output, on any machine.
- **Idempotent.** Running again on an unchanged repository changes nothing.
- No account, no API key, no LLM calls, and the CLI sends no telemetry. The documentation website is a separate application with its own operational analytics.

`recall init` refuses to overwrite an existing `.recall/` (exit code 4, nothing changed). Pass `--force` to regenerate it after your project changes.

## What it understands today

- **Languages:** TypeScript, JavaScript, Python, Go, Rust
- **Frameworks:** Next.js, NestJS, React, Express, Fastify, Vue, Angular, Nuxt, Svelte, SvelteKit, Astro, Remix, React Native, Electron, Hono, Koa
- **Package managers:** pnpm, npm, Yarn, Bun, pip, Poetry, uv, Pipenv, Go modules, Cargo
- **Layouts:** single packages and monorepos (`workspaces`, `pnpm-workspace.yaml`)
- **Tooling:** lifecycle scripts, Vitest/Jest/Mocha/AVA/Jasmine/Playwright/Cypress, ESLint/Prettier/Biome
- **Risks:** missing CI, a declared test framework with no tests, no license, no lockfile, unignored `.env` files

When the evidence for something is absent, Recall says nothing about it rather than guessing.

## Learn more

- [CLI reference](docs/cli-reference.md) — the command, the flag, and every exit code
- [Memory format](docs/memory-format.md) — `memory.json` and the agent files, field by field
- [Architecture](docs/architecture.md) — how Recall is built
- [Product specification](docs/product-specification.md) — what Recall is, guarantees, and will never do
- [Example output](examples/) — Recall's own `.recall/`, generated from this repository
- [Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

## License

[MIT](LICENSE)

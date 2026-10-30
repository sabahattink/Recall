# Memory format

The on-disk contract `recall init` produces in a repository (docs/product-specification.md §12, §13, §16). It is stable within a major version: any change to a file name, a `memory.json` field, or its meaning is a breaking change.

```
.recall/
├── memory.json
└── agents/
    ├── claude.md
    ├── codex.md
    ├── cursor.md
    ├── gemini.md
    └── openai.md
```

There is no cache, no snapshot history, no manifest, no log, and no hidden file. All six files are meant to be committed.

## `memory.json` — Project Memory

The single source of truth. Every agent file is derived from it and from nothing else.

- UTF-8, LF line endings, two-space indentation, trailing newline.
- Keys appear in the order documented below; lists are in the order described for each field. The same repository state always produces the same bytes.
- No timestamps, no absolute paths, no machine-specific values. All paths are relative to the repository root and use `/`.

### Evidence

Every claim carries `evidence`: a non-empty list of the concrete things in the repository that justify it.

```json
{ "path": "package.json", "reason": "scripts.test declared as \"vitest run\"" }
```

`path` is a repository-relative file, or `"."` when the evidence is the repository as a whole (an absence, such as "no LICENSE file at the repository root", or a Git fact). A category with no evidence is empty (`[]`) or `null` — Recall never fills a gap with a default or a guess.

### Secrets

Values copied out of manifests are scrubbed before they become part of memory, because agent files travel further than the repository (`openai.md` is meant to be pasted into a chat):

- Credentials embedded in URLs are removed — from the Git remote, dependency specifiers (`git+https://user:token@host/…`), and script bodies.
- In script bodies, the value of a secret-named assignment (`API_KEY=…`, `GITHUB_TOKEN=…`, `DB_PASSWORD=…`, …) is replaced with `<redacted>`.
- `.env` files are detected by name only; their contents are never read.

### Top level

| Key             | Type      | Contents                                |
| --------------- | --------- | --------------------------------------- |
| `schemaVersion` | `"1.0.0"` | Version of this format                  |
| `metadata`      | object    | Project identity and Git metadata       |
| `stack`         | object    | Languages, frameworks, package managers |
| `architecture`  | object    | Repository layout and entry points      |
| `structure`     | object    | Roles of top-level directories          |
| `commands`      | array     | Lifecycle scripts                       |
| `conventions`   | object    | Testing and lint/format tooling         |
| `dependencies`  | array     | Direct dependency declarations          |
| `risks`         | array     | Evidence-based risk indicators          |

### `metadata`

Each field is `{ "value": string, "evidence": [...] }` or `null`.

| Field           | Source                                                                                                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`          | First of: `package.json` `name`, `Cargo.toml` `[package].name`, `pyproject.toml` `[project].name` / `[tool.poetry].name`, `go.mod` `module`. Never the directory name. |
| `description`   | The same manifests' `description`                                                                                                                                      |
| `commit`        | The full SHA `HEAD` resolves to                                                                                                                                        |
| `defaultBranch` | The branch `refs/remotes/origin/HEAD` points to — never guessed from the current branch                                                                                |
| `remoteUrl`     | The `origin` remote URL, with any embedded credentials removed                                                                                                         |

Git values are read with read-only commands; a directory that is not a Git repository simply has `null` for them.

### `stack`

`languages`, `frameworks`, `packageManagers`: arrays of `{ "name": string, "evidence": [...] }`, in Recall's fixed detection order.

- Language names: `TypeScript`, `JavaScript`, `Python`, `Go`, `Rust`.
- Framework identifiers: `nextjs`, `nestjs`, `angular`, `nuxt`, `svelte`, `astro`, `react`, `express`, `fastify`, `vue`, `sveltekit`, `remix`, `react-native`, `electron`, `hono`, `koa`. A meta-framework suppresses the library it is built on (Next.js → React, Nuxt → Vue, …).
- Package manager identifiers: `pnpm`, `npm`, `yarn`, `bun`, `pip`, `poetry`, `uv`, `pipenv`, `go-modules`, `cargo`.

### `architecture`

```json
{
  "layout": {
    "kind": "monorepo",
    "workspaces": [".", "apps/web", "packages/core"],
    "evidence": [...]
  },
  "entryPoints": [
    { "path": "apps/cli/dist/index.js", "kind": "bin", "workspace": "apps/cli", "evidence": [...] }
  ]
}
```

- `layout` is `null` when there is no root `package.json`. `kind` is `"monorepo"` when there is at least one workspace member besides the root (`"."`, always first), otherwise `"single-package"`.
- `entryPoints` come only from manifest `bin` and `main` fields, sorted by path then kind. `workspace` is the declaring package's directory, or `null` for the root.

### `structure`

`directories`: one entry per top-level directory that contains classifiable files, sorted by path.

```json
{ "path": "src", "roles": ["source", "test"], "evidence": [...] }
```

`roles` ⊆ `source`, `test`, `config`, `documentation`, `generated`, in that order. A role is assigned only because files inside match that role's pattern — never because of the directory's name. Evidence cites up to three matching files per role.

### `commands`

Root `package.json` scripts named `install`, `build`, `test`, `lint`, `dev`, `start`, `typecheck`, or `format`, in that order:

```json
{ "name": "test", "command": "vitest run", "evidence": [...] }
```

### `conventions`

`testing` and `linting`: arrays of `{ "name", "evidence" }`.

- Testing: `vitest`, `jest`, `mocha`, `ava`, `jasmine`, `@playwright/test`, `cypress` — from a dependency declaration.
- Linting and formatting: `eslint`, `prettier`, `biome` — from a dependency or a config file.

### `dependencies`

Every direct declaration in every `package.json`, sorted by manifest path, then scope (`dependency`, `devDependency`, `peerDependency`), then name. Lockfiles are never read: only what a manifest declares directly is a dependency.

```json
{ "name": "zod", "version": "^3.24.1", "scope": "dependency", "manifest": "package.json", "evidence": [...] }
```

### `risks`

```json
{ "id": "no-license", "description": "No license file was found at the repository root.", "evidence": [...] }
```

| `id`                   | Condition                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `file-limit-reached`   | The repository has more than 20,000 files; the memory may be incomplete                                                              |
| `no-ci-configuration`  | No CI configuration (GitHub Actions, GitLab CI, CircleCI, Azure Pipelines, Bitbucket, Travis, Jenkins, Buildkite, Woodpecker, Drone) |
| `no-test-files`        | A test framework is declared but no file matches a test naming pattern                                                               |
| `no-license`           | No `LICENSE`/`LICENCE`/`COPYING`/`UNLICENSE` file (including suffixed forms such as `LICENSE-MIT`) at the root                       |
| `no-lockfile`          | A root `package.json` without a JavaScript lockfile                                                                                  |
| `env-file-not-ignored` | A `.env`/`.env.*` file (not `.example`/`.sample`/`.template`) is not ignored by the root `.gitignore`. Its contents are never read.  |

Risks are reported only for a repository with at least one source file, except `file-limit-reached`, which is always reported when it applies.

## `agents/*.md` — Agent files

Each file is rendered from `memory.json` alone by a pure Agent Template. The templates differ in format, headings, ordering, and level of detail — never in what they claim about the repository.

| File        | For              | Shape                                                                                                     |
| ----------- | ---------------- | --------------------------------------------------------------------------------------------------------- |
| `claude.md` | Claude Code      | Commands first; evidence paths cited. Import with `@.recall/agents/claude.md` in `CLAUDE.md`.             |
| `codex.md`  | OpenAI Codex     | `AGENTS.md` conventions (setup, build/test, code style, structure). Copy to `AGENTS.md`.                  |
| `cursor.md` | Cursor           | Begins with project-rule front matter (`alwaysApply: true`). Copy to `.cursor/rules/recall.mdc`. Compact. |
| `gemini.md` | Gemini CLI       | `GEMINI.md` headings. Import with `@.recall/agents/gemini.md` in `GEMINI.md`.                             |
| `openai.md` | ChatGPT / OpenAI | Compact, no file citations, for a Project's instructions or a system prompt.                              |

Repository text (names, descriptions, scripts) is escaped or placed in code spans, so it can never change a file's structure. Each file opens with a note naming its source and how to regenerate it (`npx recall-context init --force`) — don't edit agent files by hand.

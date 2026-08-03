# Memory format

This document describes the on-disk format Recall creates and maintains in a target repository's `.recall/` directory. It is the contract other tools (including future non-Recall tooling) can rely on when reading Recall's output directly instead of through the CLI.

## Directory layout

```
.recall/
├── manifest.json
├── architecture.md
├── conventions.md
├── decisions.md
├── features.md
├── glossary.md
├── risks.md
├── technical-debt.md
├── context.md              (created by `recall context`, not by `recall init`)
├── schema/
│   ├── manifest.schema.json
│   └── snapshot.schema.json
├── snapshots/
│   └── latest.json
├── backups/                 (created on demand before an overwrite; timestamped)
└── cache/                   (gitignored; safe to delete)
```

Everything except `cache/` is intended to be committed to Git.

## `manifest.json`

A versioned pointer to the current snapshot and memory files.

```json
{
  "$schema": "./schema/manifest.schema.json",
  "schemaVersion": "1.0.0",
  "toolVersion": "0.1.0",
  "repository": {
    "name": "example",
    "root": ".",
    "defaultBranch": "main"
  },
  "generatedAt": "2026-08-03T00:00:00.000Z",
  "updatedAt": "2026-08-03T00:10:00.000Z",
  "snapshot": {
    "commit": "abc123",
    "branch": "main",
    "path": "snapshots/latest.json"
  },
  "files": {
    "architecture": "architecture.md",
    "conventions": "conventions.md",
    "decisions": "decisions.md",
    "features": "features.md",
    "glossary": "glossary.md",
    "risks": "risks.md",
    "technicalDebt": "technical-debt.md"
  }
}
```

`generatedAt` is set once, on first `recall init`, and preserved across subsequent `recall update`/`recall init` runs; `updatedAt` reflects the most recent write. `schemaVersion` follows semantic versioning; `packages/schemas` exposes a `ManifestMigration` interface so a future breaking change can migrate an older manifest forward automatically.

The schema is also published as a standalone JSON Schema at `.recall/schema/manifest.schema.json`, so manifests can be validated without depending on Recall's own packages.

## `snapshots/latest.json`

The full, normalized `RepositorySnapshot` produced by the most recent `recall init`/`recall scan`/`recall update`. Its shape is defined by `packages/schemas/src/repository.ts` and published as JSON Schema at `.recall/schema/snapshot.schema.json`. Key fields:

| Field | Description |
| --- | --- |
| `repository`, `git`, `ecosystem` | Repository name/root, current Git branch/commit/dirty state, package manager and monorepo status |
| `workspaces` | Discovered workspace packages, their kind (`app`/`package`/`service`/`library`/`root`), and internal `dependsOn` |
| `files` | Every scanned file with its owning workspace and kind (`source`/`test`/`config`/`documentation`/`generated`/`other`) |
| `entryPoints` | Detected `bin`/`main`/`script`/`framework-convention` entry points, each with evidence |
| `dependencies`, `internalEdges` | Declared dependencies and internal (workspace- and import-level) dependency edges |
| `frameworks`, `conventions`, `risks` | Evidence-backed findings, each with a `confidence` or `severity` and an `evidence` array |
| `testing`, `ci`, `docker`, `serviceIntegrations` | Detected test frameworks/files, CI configuration, Docker configuration, and service integrations (database/queue/cache/auth/external) |
| `generatedFiles`, `ignoredDirectories` | Files classified as generated, and the directories Recall never scans |

## Generated-section markers

Every Markdown memory file wraps Recall-authored content in an explicit marker pair:

```markdown
<!-- recall:generated:start -->
...content Recall regenerates on every `recall update`...
<!-- recall:generated:end -->
```

Rules Recall follows, enforced by `packages/memory/src/markers.ts`:

- On `recall init`/`recall update`, only the text **between** the markers is replaced. Everything before the start marker and after the end marker is left byte-for-byte untouched.
- If a file does not exist yet, Recall scaffolds it from a template: the generated section plus a `## Notes` section inviting human-authored content.
- If a file exists but has no markers at all (e.g. a human created it by hand), Recall **prepends** the generated section rather than touching the existing content.
- If a file has malformed markers (missing pair, duplicated pair, or an end marker before a start marker), Recall leaves the file completely untouched and reports it via `recall doctor`/`recall status` rather than guessing how to repair it.

## The seven memory files

| File | Content | Notes |
| --- | --- | --- |
| `architecture.md` | Detected apps/packages/layers, entry points, internal dependency direction, infrastructure boundaries | Separates a "Detected facts" section from an "Inferred structure" section |
| `conventions.md` | File/directory naming, import aliases, test naming, linting/formatting, package scripts, error-handling patterns | Only includes conventions with supporting evidence |
| `decisions.md` | Human-editable ADR log | Recall never fabricates decisions; it may list evidence-backed **unconfirmed candidates** (e.g. "appears to use PostgreSQL"), clearly labeled as such |
| `features.md` | Features backed by strong structural evidence: controllers, routes, modules, job processors, event handlers, feature directories | Every entry includes evidence paths |
| `glossary.md` | Recurring domain terms extracted from identifiers and directory names | Definitions are left as "unresolved" — Recall does not invent meanings |
| `risks.md` | Evidence-based risk findings (missing tests, circular dependencies, large files, committed `.env` files, missing lockfile, unpinned Docker images, etc.) | Not a security scanner — see [SECURITY.md](../SECURITY.md) |
| `technical-debt.md` | A subset of risk findings that represent accumulated debt (large files, deep coupling, duplicate dependency versions, missing tests/lockfile, circular dependencies) | Each entry includes severity and evidence |

## `context.md`

Written by `recall context` (unless `--stdout` is passed). Twelve fixed sections: project summary, repository layout, architecture, important conventions, primary entry points, important commands, known risks, technical debt, relevant decisions, files an agent should read first, files/directories to avoid modifying, and current Git state. See [cli-reference.md](cli-reference.md#recall-context) for `--task`, `--max-tokens`, and truncation behavior.

## Backups

Before overwriting an existing Recall-managed file (`manifest.json`, `snapshots/latest.json`, or any of the seven Markdown files, when its content actually changes), Recall copies the previous contents into `.recall/backups/<name>.<ISO-timestamp>.bak`. Backups accumulate; pruning is a manual/future operation (see [roadmap.md](roadmap.md)).

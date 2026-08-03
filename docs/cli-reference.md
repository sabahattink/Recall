# CLI reference

## Global options

These apply to every command:

| Flag | Description |
| --- | --- |
| `--path <dir>` | Repository path to operate on (default: `.`) |
| `--json` | Emit machine-readable JSON on stdout instead of human-readable text |
| `--quiet` | Suppress non-essential output (warnings and errors still print to stderr) |
| `--verbose` | Print stack traces on failure |
| `--no-color` | Disable colored output |

`recall --help`, `recall --version`, and `recall <command> --help` are always available.

## Output and exit-code conventions

- stdout carries successful command output only (human text, or a single JSON document in `--json` mode).
- stderr carries diagnostics, warnings, and errors.
- No stack trace is printed unless `--verbose` is set.
- No progress/status line is printed in non-interactive (non-TTY) environments, in `--json` mode, or with `--quiet`.
- `Ctrl+C` (`SIGINT`) prints `Cancelled.` and exits with code `130`.

| Exit code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | Unexpected failure |
| `2` | Invalid usage (bad arguments, missing path) |
| `3` | Invalid Recall state (not initialized, corrupted manifest/snapshot) |
| `4` | Stale memory (`recall update --check`, or a stale `recall status`) |
| `5` | Analysis incomplete (a scan hit `--max-files` and was truncated) |

## `recall init`

Creates or refreshes `.recall/` for the current repository: detects Git, package manager, monorepo structure, frameworks, entry points, and workspaces; writes `manifest.json`, `snapshots/latest.json`, and the seven Markdown memory files; adds `.recall/cache/` to `.gitignore`.

```
recall init [--force] [--dry-run] [--path <dir>] [--max-files <n>]
```

- `--force` — resets `generatedAt` and forces a full manifest refresh, even if already initialized. Human-authored content in Markdown files is **always** preserved regardless of `--force`.
- `--dry-run` — reports what would be written without writing anything.

Running `recall init` again on an already-initialized repository is idempotent and safe: generated sections are refreshed, human-authored content is preserved, and unchanged files are left untouched.

Exit codes: `5` if the file scan was truncated by `--max-files`, otherwise `0`.

## `recall scan`

Runs deterministic repository analysis and prints a summary (or the full snapshot JSON with `--json`), optionally saving it to an explicit path.

```
recall scan [--json] [--output <path>] [--max-files <n>]
```

- `--output <path>` — writes the snapshot JSON to this path (in addition to the summary/JSON printed to stdout).
- `--max-files <n>` — caps the number of files scanned (default 20,000).

Exit codes: `5` if truncated, otherwise `0`.

## `recall update`

Compares the current repository against the last snapshot and refreshes memory, preserving human-authored Markdown content.

```
recall update [--since <ref>] [--dry-run] [--check] [--json]
```

- `--since <ref>` — additionally reports the Git diff between `<ref>` and `HEAD` (e.g. `HEAD~5`) as part of the change report.
- `--dry-run` — reports the change report and staleness without writing anything.
- `--check` — reports the change report without writing anything, and exits `4` if memory is stale. Designed for CI:

  ```yaml
  - run: recall update --check
  ```

Exit codes: `4` if `--check` is set and memory is stale, otherwise `0`.

## `recall status`

Shows whether Recall is initialized, the last snapshot's commit, the current commit, changed files since the snapshot, staleness, missing/malformed memory files, and the detected project type.

```
recall status [--json]
```

Exit codes: `3` if not initialized or memory is corrupted, `4` if stale, otherwise `0`.

## `recall explain <path>`

Explains the role of a file or directory using deterministic evidence: likely responsibility, owning workspace, incoming/outgoing internal dependencies, related tests, relevant configuration and scripts, a confidence level, and supporting evidence. Requires a prior `recall init`/`recall scan`.

```
recall explain <path> [--json]
```

Example:

```
recall explain src/auth/auth.service.ts
recall explain apps/api
recall explain packages/database --json
```

Exit codes: `3` if no snapshot exists, `2` if the path does not exist, otherwise `0`.

## `recall context`

Generates compact, agent-ready context from the last snapshot. Writes `.recall/context.md` by default.

```
recall context [--task "<description>"] [--max-tokens <n>] [--format markdown] [--stdout] [--json]
```

- `--task "<description>"` — focuses the context on a task: keywords are extracted from the description and used to rank source files by path relevance.
- `--max-tokens <n>` — approximate maximum size of the generated context. Token estimation is a fixed, documented heuristic (~4 characters/token; see [architecture.md](architecture.md)), not a model-specific tokenizer. When the estimate exceeds the budget, list-based sections are shrunk through a fixed sequence of item caps (20 → 10 → 5 → 3 → 1) until the content fits, or hard-truncated as a last resort.
- `--format markdown` — currently the only supported format (the flag exists for forward compatibility).
- `--stdout` — prints to stdout instead of writing `.recall/context.md`.

Exit codes: `3` if no snapshot exists, otherwise `0`.

## `recall doctor`

Validates the runtime, Git availability, repository access, manifest/snapshot validity, Markdown marker integrity, memory freshness, broken internal references, and package-manager configuration.

```
recall doctor [--json]
```

Exit codes: `3` if any check fails (e.g. not initialized, corrupted manifest), otherwise `0` (warnings do not fail the command, but are reported).

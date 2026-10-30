# CLI reference

Recall has one command and one flag (docs/product-specification.md §18).

```
recall init [path] [--force]
```

Run it without installing anything:

```bash
npx recall-context init
```

The npm package is `recall-context`; the executable it installs is `recall`.

## `recall init`

Scans the repository at `path` (default: the current directory) and writes `.recall/` inside it.

| Argument / flag | Meaning                                                                         |
| --------------- | ------------------------------------------------------------------------------- |
| `path`          | Repository to initialize. Relative paths resolve against the current directory. |
| `--force`       | Regenerate `.recall/` when it already exists, replacing it as a whole.          |

Use `--` to pass a path that starts with `-`: `recall init -- -odd-name`.

### Output

On success, stdout is exactly:

```
Scanning repository...
Detecting architecture...
Generating AI memory...
Done.
```

Nothing else is printed on success. Errors go to stderr as a single `error: …` line.

### What it writes

Exactly six files, and nothing outside them:

```
.recall/memory.json
.recall/agents/claude.md
.recall/agents/codex.md
.recall/agents/cursor.md
.recall/agents/gemini.md
.recall/agents/openai.md
```

See [memory-format.md](memory-format.md). The files are written to a staging directory next to `.recall/` and renamed into place, so `.recall/` is either absent, the previous version, or the complete new version — never partial.

### With an existing `.recall/`

- Without `--force`: refuses with exit code 4 and changes nothing.
- With `--force`: replaces the whole directory. Anything you added inside `.recall/` is removed — keep hand-written instructions in `CLAUDE.md`, `AGENTS.md`, or similar instead.
- A `.recall` that is a symlink (or a Windows junction) or a regular file is always refused, with or without `--force`, so Recall can never be redirected into writing elsewhere on disk.

## Exit codes

| Code | Meaning                                                                     |
| ---- | --------------------------------------------------------------------------- |
| `0`  | Success.                                                                    |
| `1`  | Unexpected internal failure.                                                |
| `2`  | Invalid usage: unknown command, unknown option, or more than one path.      |
| `3`  | Invalid path: it does not exist, is not a directory, or cannot be read.     |
| `4`  | `.recall/` already exists and `--force` was not given. Nothing was changed. |
| `5`  | Unsafe output location: `.recall` is a symlink or is not a directory.       |

Every failure leaves the repository exactly as it was.

## Conventional meta flags

`-h`/`--help` prints usage and `-v`/`--version` prints `recall/<version>`; both exit `0` and do nothing else.

## Environment

`RECALL_DEBUG=1` adds a stack trace to an unexpected failure (exit code `1`). Without it, no error ever prints a stack trace.

Recall reads no other environment variables and no configuration files.

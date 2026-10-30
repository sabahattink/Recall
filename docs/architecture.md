# Architecture

How Recall itself is built. For what it produces, see [memory-format.md](memory-format.md); for what it is and guarantees, see [product-specification.md](product-specification.md); for the task breakdown, see [implementation-blueprint.md](implementation-blueprint.md).

## Pipeline

```
Repository → Scanner → Project Memory → Agent Templates → Disk
```

Five stages, no more (spec §14). Each stage is owned by exactly one package and is a plain function call — no plugin framework, dependency injection, event bus, queue, or background worker.

| Stage           | Package                | Entry point                                               | Output                              |
| --------------- | ---------------------- | --------------------------------------------------------- | ----------------------------------- |
| Scanner         | `@recall-ai/analyzers` | `scanRepository(root, { git })`                           | `Fact[]`                            |
| (Git metadata)  | `@recall-ai/git`       | `new GitAdapter(root).collectMetadata()`                  | `GitMetadata \| null`               |
| Project Memory  | `@recall-ai/memory`    | `normalizeFacts(facts)`, `serializeProjectMemory(memory)` | `ProjectMemory`, `memory.json` text |
| Agent Templates | `@recall-ai/templates` | `DEFAULT_TEMPLATE_REGISTRY.render(memory)`                | agent file texts                    |
| Disk            | `@recall-ai/memory`    | `writeRecallDirectory(root, files, { force })`            | `.recall/`                          |
| Orchestration   | `@recall-ai/core`      | `runInit({ path, force, onStage })`                       | —                                   |
| Interface       | `apps/cli`             | `runCli(argv, io)`                                        | stdout, exit code                   |

## Package graph

```
schemas ◄── git
   ▲   ◄── analyzers
   │   ◄── memory
   │   ◄── templates
   │
core ──► schemas, git, analyzers, memory, templates
   ▲
apps/cli (bundled into the published recall-context package)

test-fixtures — reference repositories, used only by tests and scripts/ci-verify.mjs
```

No cycles. `analyzers`, `memory`, and `templates` depend only on `schemas`, so none of them can reach into another stage.

- **`schemas`** — the Fact schema (a discriminated union over the twelve categories of spec §15, each with a typed `value`), the ProjectMemory schema, `GitMetadata`, and `compareStrings`, the one ordering every sorted list uses.
- **`git`** — read-only Git metadata through fixed-argument `git -C <root>` calls to an absolutely resolved `git` (Windows would otherwise run a `git.exe` sitting in the repository). Every call passes `-c core.fsmonitor=false` and drops inherited `GIT_DIR`-style variables; the remote URL is read from the repository's own config (not rewritten by global `insteadOf` rules) and stripped of embedded credentials.
- **`analyzers`** — the Scanner. One walk of the repository (`walkRepository`), then independent detectors over that file list. Facts are validated against the schema before they leave the package.
- **`memory`** — normalization (pure), canonical serialization, and the only code that writes to disk.
- **`templates`** — the `AgentTemplate` contract, the five templates, and `defineTemplateRegistry`, the single registration mechanism. Templates import nothing from Node.js; a test enforces it.
- **`core`** — `runInit`: resolve the path, refuse early if the output location is unusable, then run the stages in order. It contains no detection, normalization, or rendering logic.
- **`apps/cli`** — a strict argument parser, the four progress lines, error printing, and exit codes.

## Adding an assistant

One new `AgentTemplate` in `packages/templates/src/agents/` and one entry in `DEFAULT_TEMPLATE_REGISTRY` (spec §17). Nothing in the Scanner, Project Memory, or core changes; `registry.test.ts` proves it. It does change the output contract of spec §12, so the specification is revised first.

## Determinism

The same repository state produces byte-identical output on every machine (spec §9, §20):

- **One ordering.** Every sort uses `compareStrings` (UTF-16 code unit order), never `localeCompare`, whose result depends on the machine's ICU locale.
- **Fixed emission orders.** Detectors emit in hand-written rule order, never in object-key or `Map` order of input data.
- **Schema-ordered serialization.** `memory.json` is produced by parsing through `ProjectMemorySchema`, which rebuilds every object in schema key order, then `JSON.stringify` with two-space indentation and `\n` newlines.
- **No environment in the output.** No timestamps, no absolute paths, no directory name, no locale, no working-tree state. Git values are limited to ones that describe the repository (`HEAD`, `origin/HEAD`, the `origin` URL); dirtiness and untracked files are excluded so `.recall/` appearing on disk cannot change the next run.
- **The scan ignores its own output.** Root `.recall*` directories (the output and its staging siblings) are excluded from the walk.

Golden tests pin the output of every stage: Scanner facts per reference fixture (`packages/analyzers/src/__tests__/__golden__`), each template against a fixed memory (`packages/templates/src/__tests__/__golden__`), and the complete `.recall/` per reference fixture (`packages/core/src/__tests__/__golden__`). An intentional change regenerates them with `vitest run -u` and is reviewed as a diff. `.gitattributes` keeps golden files LF on every platform.

## Writing `.recall/`

`writeRecallDirectory` makes the write all-or-nothing (spec §20):

1. Refuse a `.recall` that is a symlink, a junction, or a file — with or without `--force`.
2. Write every file into a fresh `mkdtemp` staging directory beside `.recall/` (`.recall.staging-*`), flushing each with `fsync`.
3. Without `--force`: rename the staging directory to `.recall`. With `--force`: rename the old `.recall` aside (`.recall.previous-*`), rename staging into place, then delete the old copy; if the second rename fails, the old copy is moved back.
4. On any failure, remove the staging directory. Renames retry briefly on Windows `EPERM`/`EBUSY` (antivirus, indexers, editors holding a handle).

A reader therefore only ever sees no `.recall/`, the previous one, or the complete new one. A process killed mid-run can leave a `.recall.staging-*` directory behind, but never a partial `.recall/`.

## Safety

- **Read-only.** The Scanner reads file names and manifest contents (`package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`); it never executes, imports, or evaluates repository code. `.env` files are detected by name only and never opened.
- **No network.** No package performs network I/O. `scripts/ci-verify.mjs` runs the compiled CLI with a preload that throws on any network API, under Node's permission model with writes allowed only inside the repository.
- **Malformed input is not evidence.** Manifest values of the wrong type are skipped, never coerced.
- **Repository text can't restructure agent files.** Templates escape Markdown control characters and put values in code spans, so a hostile `description` cannot inject headings into a file an assistant treats as instructions.

## Performance

The walk streams entries with `fast-glob`, never follows symlinks, skips dependency, build, cache, and VCS directories at any depth, respects the root `.gitignore`, and stops at 20,000 files. A truncated walk is reported as the `file-limit-reached` risk rather than silently under-reporting. Each manifest is read at most once per detector, and no other file content is read at all.

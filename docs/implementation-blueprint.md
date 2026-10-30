# Recall v1 — Implementation Blueprint

**Status:** Canonical engineering roadmap
**Source of truth:** `docs/product-specification.md` (frozen). Every task below implements a specific section of that document. No task introduces a concept the specification does not already contain.

---

## 1. Milestones

Each milestone produces something demonstrable on its own — runnable, inspectable output, not an internal abstraction.

### Milestone 1 — Repository Scanner
Demonstrable: given any repository on disk, produce a complete set of Facts (spec §6, §15) as an in-memory/printable result. No memory.json yet, no templates yet.

### Milestone 2 — Project Memory
Demonstrable: given Facts, produce a valid `memory.json` on disk for a real repository (spec §13, §16).

### Milestone 3 — Agent Templates
Demonstrable: given a `memory.json`, produce all five agent files — `claude.md`, `codex.md`, `cursor.md`, `gemini.md`, `openai.md` — as strings (spec §17).

### Milestone 4 — CLI
Demonstrable: `npx recall-context init` runs end to end against a real repository and produces the exact `.recall/` output contract (spec §11, §12, §18).

### Milestone 5 — Polish
Demonstrable: the published npm package, installed from a clean environment, produces correct, deterministic, cross-platform output and is ready for public release.

No additional milestones. Every engineering task below belongs to exactly one of these five.

---

## 2. Engineering Tasks

### Milestone 1 — Repository Scanner

**SCAN-01 — Define the Fact schema**
- Description: Define the type and runtime schema for a Fact and the collection of Facts the Scanner produces, per spec §6 (Fact, Repository) and §15 (fact categories: languages, frameworks, package manager, workspace layout, directories, commands, testing framework, linting, architecture hints, dependencies, repository metadata, risk indicators).
- Dependencies: none
- Acceptance Criteria:
  - Schema covers every fact category listed in spec §15, with no additional categories.
  - Schema is the only definition of "Fact" in the codebase; no package redefines it independently.
  - Schema validation rejects a Fact with no evidence reference.

**SCAN-02 — Filesystem walker with ignore rules**
- Description: Walk a repository's file tree, excluding version control internals, dependency directories, and build output, producing the file list every other detector reads from.
- Dependencies: none
- Acceptance Criteria:
  - Walker excludes `.git`, dependency directories (e.g. `node_modules`), and common build output directories by evidence (lockfile/config-derived), not by a hardcoded opinion list alone.
  - Walker completes on a repository with 10,000+ files without exhausting memory.
  - Walker output is stable: two runs against an unchanged tree return files in the same order.

**SCAN-03 — Language, package manager, and runtime detection**
- Description: Detect languages present and the package manager/runtime in use, from concrete evidence (lockfiles, manifest files, file extensions).
- Dependencies: SCAN-01, SCAN-02
- Acceptance Criteria:
  - Every detected language/package manager/runtime Fact cites the file(s) that justify it.
  - Absence of evidence produces no Fact, not a default guess.
  - Detection covers at minimum: Node.js/TypeScript, Python, Go, Rust (evidence-based; a stack with no matching evidence produces an empty result, not an error).

**SCAN-04 — Framework detection**
- Description: Detect application frameworks in use, from dependency declarations and characteristic config files.
- Dependencies: SCAN-03
- Acceptance Criteria:
  - Every framework Fact cites the dependency entry or config file that justifies it.
  - A repository using no recognized framework produces zero framework Facts, not an error.
  - False-positive rate on the reference fixture set (§6 test strategy) is zero.

**SCAN-05 — Workspace and monorepo layout detection**
- Description: Detect whether the repository is a single package or a workspace/monorepo, and enumerate member packages.
- Dependencies: SCAN-02, SCAN-03
- Acceptance Criteria:
  - Single-package repositories produce a workspace list of exactly one entry.
  - Monorepo detection is evidence-based (workspace manifest field, workspace config file), not directory-name heuristics alone.

**SCAN-06 — Command and tooling detection**
- Description: Detect install/build/test/lint/dev commands, testing framework, and linting configuration, from manifest scripts and config files.
- Dependencies: SCAN-03
- Acceptance Criteria:
  - Each detected command Fact cites the manifest entry it was read from.
  - Testing framework and linter detection each cite the dependency or config file used.
  - A command that cannot be evidenced is omitted, not inferred.

**SCAN-07 — Dependency extraction**
- Description: Extract the repository's direct dependencies as Facts.
- Dependencies: SCAN-03
- Acceptance Criteria:
  - Every extracted dependency Fact cites its manifest entry.
  - Transitive/lockfile-only dependencies are not extracted as Facts (evidence must be a direct declaration).

**SCAN-08 — Architecture hint detection**
- Description: Detect directory roles (source, tests, config, docs, generated) and entry points, from structural and configuration evidence.
- Dependencies: SCAN-02, SCAN-05
- Acceptance Criteria:
  - Every directory-role Fact cites the evidence (config reference, naming convention backed by a build/test config entry) that justifies the role.
  - Entry points are sourced from manifest fields, not assumed by filename alone where a manifest field exists.

**SCAN-09 — Risk indicator detection**
- Description: Detect evidence-based risk signals (e.g. absence of a CI configuration, absence of a test directory given a detected test framework, absence of a license file).
- Dependencies: SCAN-06, SCAN-08
- Acceptance Criteria:
  - Every risk Fact cites the concrete absence or condition it is based on.
  - Risk detection never produces a subjective or stylistic judgment (e.g. no "code quality" scoring).

**SCAN-10 — Repository metadata via git**
- Description: Attach repository metadata (name, default branch, current commit, remote URL if present) using `@recall-ai/git`, when the repository is a git repository.
- Dependencies: SCAN-01
- Acceptance Criteria:
  - Non-git repositories produce a complete Fact set with git-derived fields simply absent — scanning never fails because git metadata is unavailable.
  - Git-derived Facts are read-only; no git command mutates repository state.

**SCAN-11 — Scanner integration test suite**
- Description: Run the full Scanner against the reference fixture repositories (§6) and assert the resulting Fact set matches expectations for each fixture.
- Dependencies: SCAN-01 through SCAN-10
- Acceptance Criteria:
  - Scanner runs to completion on every reference fixture with no unhandled error.
  - Fact output for each fixture matches a committed expected result.

---

### Milestone 2 — Project Memory

**MEM-01 — Define the ProjectMemory schema**
- Description: Define the type and runtime schema for Project Memory, per spec §16 (metadata, technology stack, architecture, repository structure, commands, conventions, dependencies, risk areas).
- Dependencies: SCAN-01
- Acceptance Criteria:
  - Schema contains exactly the categories listed in spec §16, no more.
  - Schema contains no field referencing a specific Agent (per spec §16: "Project Memory has no concept of Claude, Cursor, Codex, Gemini, or OpenAI").

**MEM-02 — Fact-to-ProjectMemory normalization**
- Description: Implement the transformation from a Fact set into a single ProjectMemory instance.
- Dependencies: SCAN-11, MEM-01
- Acceptance Criteria:
  - Every ProjectMemory field is traceable to one or more input Facts; no field is populated without a corresponding Fact.
  - Normalization is a pure function: identical Fact input always produces identical ProjectMemory output.

**MEM-03 — Canonical `memory.json` serialization**
- Description: Serialize ProjectMemory to `memory.json` with a fixed, stable key order and formatting.
- Dependencies: MEM-02
- Acceptance Criteria:
  - Serializing the same ProjectMemory twice produces byte-identical output.
  - Output validates against the schema defined in MEM-01.

**MEM-04 — Atomic write for `memory.json`**
- Description: Write `memory.json` to `.recall/` using an atomic write (write-then-rename), never a partial write.
- Dependencies: MEM-03
- Acceptance Criteria:
  - An interrupted write never leaves a corrupt or truncated `memory.json` on disk.
  - Write only ever touches paths inside `.recall/`.

**MEM-05 — Normalization unit tests**
- Description: Unit test MEM-02 against fixed Fact fixtures covering each ProjectMemory category.
- Dependencies: MEM-02
- Acceptance Criteria:
  - At least one test per ProjectMemory top-level category.
  - Tests cover the empty/absent-evidence case for each category (no Facts in a category → empty/absent in ProjectMemory, not an error).

**MEM-06 — Determinism test for memory generation**
- Description: Run normalization and serialization against an unchanged Fact set multiple times and assert byte-identical `memory.json` output each time.
- Dependencies: MEM-03, MEM-05
- Acceptance Criteria:
  - Ten consecutive runs against the same input produce byte-identical output.

---

### Milestone 3 — Agent Templates

**TPL-01 — Agent Template contract and registry**
- Description: Define the Agent Template interface (a read-only transformation from ProjectMemory to a string, per spec §17) and the registration mechanism new templates use.
- Dependencies: MEM-01
- Acceptance Criteria:
  - A template has no dependency on filesystem, git, or network access — only on a ProjectMemory value.
  - The registry has one, and only one, mechanism for adding a template.

**TPL-02 — Claude template**
- Description: Render `claude.md` from ProjectMemory.
- Dependencies: TPL-01
- Acceptance Criteria:
  - Output contains no information absent from the input ProjectMemory.
  - Output is non-empty for every reference fixture.

**TPL-03 — Codex template**
- Description: Render `codex.md` from ProjectMemory.
- Dependencies: TPL-01
- Acceptance Criteria: same as TPL-02, for `codex.md`.

**TPL-04 — Cursor template**
- Description: Render `cursor.md` from ProjectMemory.
- Dependencies: TPL-01
- Acceptance Criteria: same as TPL-02, for `cursor.md`.

**TPL-05 — Gemini template**
- Description: Render `gemini.md` from ProjectMemory.
- Dependencies: TPL-01
- Acceptance Criteria: same as TPL-02, for `gemini.md`.

**TPL-06 — OpenAI template**
- Description: Render `openai.md` from ProjectMemory.
- Dependencies: TPL-01
- Acceptance Criteria: same as TPL-02, for `openai.md`.

**TPL-07 — Template golden-output tests**
- Description: Golden-file tests for each template against a fixed ProjectMemory fixture.
- Dependencies: TPL-02 through TPL-06
- Acceptance Criteria:
  - Each template has a committed expected output file.
  - Any output diff fails the test until the golden file is explicitly, deliberately updated.

**TPL-08 — Registry extension test**
- Description: Test proving the spec §17 guarantee: adding a new agent requires exactly one new template file and one registration call, with no change to any other package.
- Dependencies: TPL-01
- Acceptance Criteria:
  - Test adds a throwaway template and registers it without modifying `schemas`, `analyzers`, `memory`, or `core`.

---

### Milestone 4 — CLI

**CLI-01 — `recall init` command skeleton**
- Description: Implement argument parsing for `recall init [path] [--force]` and repository path resolution.
- Dependencies: none
- Acceptance Criteria:
  - Omitting `path` defaults to the current working directory.
  - An invalid path produces a clear error and non-zero exit code before any scanning begins.

**CLI-02 — Pipeline orchestration**
- Description: Implement the single use-case that wires Scanner → normalize → render (all five templates) → write, per the Architecture Shape in spec §14.
- Dependencies: SCAN-11, MEM-06, TPL-07
- Acceptance Criteria:
  - Orchestration package contains no scanning, normalization, or rendering logic of its own — only sequencing and error propagation.
  - A failure at any stage aborts before any file is written to `.recall/`.

**CLI-03 — Output writer**
- Description: Write the complete `.recall/` output — `memory.json` and `agents/{claude,codex,cursor,gemini,openai}.md` — matching spec §12 exactly, atomically as a single unit.
- Dependencies: CLI-02, MEM-04
- Acceptance Criteria:
  - Successful run produces exactly the six files listed in spec §12, no more, no fewer.
  - A failure partway through writing leaves no `.recall/` directory behind (spec §20: no silent partial success).

**CLI-04 — Progress output**
- Description: Print the exact progress sequence from spec §11: `Scanning repository...`, `Detecting architecture...`, `Generating AI memory...`, `Done.`
- Dependencies: CLI-02
- Acceptance Criteria:
  - Stdout output matches spec §11 verbatim, in order, with nothing printed before or after.

**CLI-05 — `--force` behavior**
- Description: Implement default behavior when `.recall/` already exists (refuse and exit non-zero) and `--force` behavior (overwrite atomically).
- Dependencies: CLI-03
- Acceptance Criteria:
  - Running `recall init` twice without `--force` on an existing `.recall/` makes no change to disk and exits non-zero.
  - Running with `--force` produces output identical to a first-time run on an equivalent repository state.

**CLI-06 — Error handling and exit codes**
- Description: Define and implement exit codes for: success, invalid path, existing output without `--force`, and unexpected internal failure.
- Dependencies: CLI-01, CLI-05
- Acceptance Criteria:
  - Each error condition has one dedicated, documented exit code.
  - No error condition prints a stack trace to a normal (non-debug) invocation.

**CLI-07 — End-to-end CLI tests**
- Description: Run the compiled CLI against every reference fixture and assert the full `.recall/` output contract.
- Dependencies: CLI-03, CLI-04, CLI-05, CLI-06
- Acceptance Criteria:
  - Every reference fixture produces the exact six-file output contract with valid, template-matching content.

---

### Milestone 5 — Polish

**REL-01 — Cross-platform CI matrix**
- Description: Run the full test suite on Linux, macOS, and Windows for every change.
- Dependencies: CLI-07
- Acceptance Criteria: all three platforms pass identically; no platform-conditional test skips without a documented reason tied to a real OS constraint.

**REL-02 — Determinism and idempotency suite in CI**
- Description: Promote MEM-06 and CLI-05's idempotency checks into a standing CI suite run on every change.
- Dependencies: REL-01
- Acceptance Criteria: suite runs on every CI invocation and fails the build on any non-deterministic or non-idempotent output.

**REL-03 — npm packaging**
- Description: Finalize the published package: `bin` entry, file allowlist, manifest fields, and a pack-and-install dry run.
- Dependencies: CLI-07
- Acceptance Criteria:
  - `npm pack` output installed into a clean directory exposes a working `recall` executable.
  - Packed tarball contains no workspace-internal files (tests, fixtures, source maps beyond what's intended).

**REL-04 — README quickstart**
- Description: Write the public README's quickstart to match spec §11 exactly — one command, the exact printed sequence, no additional setup steps described.
- Dependencies: CLI-07
- Acceptance Criteria: a reader following only the README reaches a working `.recall/` in one command, with no step the specification does not describe.

**REL-05 — CLI reference documentation**
- Description: Document `recall init` and `--force` per spec §18 — the complete public command surface, nothing more.
- Dependencies: CLI-06
- Acceptance Criteria: documentation lists exactly one command and one flag; no undocumented flag exists in the shipped binary.

**REL-06 — Reference fixture set and golden outputs**
- Description: Finalize the committed set of reference repositories (representative stacks) and their golden `memory.json`/agent-file outputs used throughout the test strategy.
- Dependencies: SCAN-11, TPL-07, CLI-07
- Acceptance Criteria: fixture set covers at least one single-package and one monorepo case, across at least two distinct language ecosystems.

**REL-07 — GitHub Release process**
- Description: Tag the release, generate release notes from the change history, publish a non-draft GitHub Release.
- Dependencies: REL-03
- Acceptance Criteria: release tag matches the published npm version exactly; release notes contain no claim beyond what spec v1 delivers.

**REL-08 — Post-publish smoke test**
- Description: After publishing, install the real published package (not a local workspace link) into a clean environment and run `recall init` against a real repository.
- Dependencies: REL-03, REL-07
- Acceptance Criteria: output matches the same contract verified in CLI-07, using the publicly published artifact.

---

## 3. Package Ownership

Ownership is exclusive. No responsibility below is shared between two packages.

| Package | Owns | Does not own |
|---|---|---|
| `@recall-ai/schemas` | Fact schema, ProjectMemory schema, shared type definitions | Any detection, normalization, or rendering logic |
| `@recall-ai/git` | Read-only git metadata (branch, commit, remote) | File-tree scanning, dependency parsing, any write operation |
| `@recall-ai/analyzers` | The Scanner: filesystem walking, language/framework/tooling/dependency/risk detection, Fact production | Normalization into ProjectMemory, any file writes outside its own read operations, agent-specific formatting |
| `@recall-ai/memory` | Fact-to-ProjectMemory normalization, `memory.json` serialization, atomic writes to `.recall/` | Repository scanning, agent-specific rendering, CLI argument handling |
| `@recall-ai/templates` | Agent Template contract, the five agent renderers, the template registry | Any repository or filesystem access, any knowledge not present in the ProjectMemory it is given |
| `@recall-ai/core` | Pipeline orchestration (the single `runInit` use case): sequencing Scanner → Memory → Templates → disk | Detection logic, normalization logic, rendering logic, argument parsing |
| `apps/cli` | Argument parsing, progress output, exit codes, invoking `core.runInit` | Any repository knowledge, normalization, or rendering |

If a task cannot be placed in exactly one row of this table, the task is not ready to start — the responsibility split must be resolved first.

---

## 4. Public Contracts

These MUST remain stable once Recall v1 ships. A breaking change to any of these is a major-version event, not a patch.

- **`memory.json` schema** — the ProjectMemory shape (spec §16), including field names and structure.
- **Agent Template contract** — a template is a pure `ProjectMemory → string` transformation; this signature and its purity guarantee (spec §17) must not change.
- **Template registration mechanism** — the one way a new agent is added (spec §17).
- **CLI interface** — `recall init [path] [--force]`, its exit codes, and its exact progress output (spec §11, §18).
- **Output directory** — `.recall/` as the sole write location (spec §7, §20).
- **Generated filenames** — `memory.json`, `agents/claude.md`, `agents/codex.md`, `agents/cursor.md`, `agents/gemini.md`, `agents/openai.md` (spec §12).
- **Fact schema** — the package boundary contract between `analyzers` and `memory`; downstream normalization depends on its shape remaining stable within a version.

---

## 5. Test Strategy

- **Unit tests.** Every Scanner detector tested in isolation against minimal fixtures. Every normalization category tested in isolation against fixed Fact input. Every Agent Template tested in isolation against a fixed ProjectMemory input.
- **Integration tests.** The full pipeline — Scanner through disk write — run against complete reference repositories, asserting the end-to-end `.recall/` output.
- **Golden output tests.** Committed expected `memory.json` and agent files for each reference fixture. A test failure means either a real regression or a deliberate, reviewed update to the golden files — never a silently accepted diff.
- **Cross-platform tests.** The full suite run on Linux, macOS, and Windows in CI. Any test that only passes on one platform is treated as a bug, not a platform quirk to work around with a skip.
- **Determinism tests.** The same repository state, scanned and generated multiple times, must produce byte-identical output every time, on every platform.
- **Idempotency tests.** Running `recall init` a second time (with `--force`) against an unchanged repository must produce output identical to the first run. Running it without `--force` must make no change to disk.

No implementation detail (test framework, mocking approach, fixture format) belongs in this document — only the categories above and what each is responsible for proving.

---

## 6. Release Checklist

- [ ] All Milestone 1–4 tasks complete and passing in CI.
- [ ] Cross-platform CI matrix green on Linux, macOS, Windows (REL-01).
- [ ] Determinism and idempotency suites green (REL-02).
- [ ] npm package builds, packs, and installs cleanly from the packed tarball (REL-03).
- [ ] Published package name reserved and available on the npm registry.
- [ ] README quickstart verified against spec §11, word for word where the spec is literal (REL-04).
- [ ] CLI reference documents exactly one command and one flag (REL-05).
- [ ] Reference fixture set and golden outputs finalized and committed (REL-06).
- [ ] Website reflects only what v1 ships — no capability from spec §19 (Non-Goals) implied or mentioned.
- [ ] At least one worked example (a real repository's generated `.recall/` output) published for reference.
- [ ] Installation verified on a machine with no prior Recall artifacts and no monorepo-specific environment.
- [ ] GitHub Release tagged, notes published, tag matches npm version exactly (REL-07).
- [ ] Post-publish smoke test passed against the real published package, not a local workspace build (REL-08).
- [ ] Zero-network-access guarantee verified for a full `init` run.
- [ ] No file outside `.recall/` modified by a full `init` run, verified.

---

## 7. Out of Scope

Everything below is excluded from Recall v1, per spec §19 (Non-Goals) verbatim:

- Cloud synchronization
- Accounts
- Embeddings
- Vector databases
- Retrieval-augmented generation (RAG)
- Background indexing
- MCP (Model Context Protocol) integration
- Realtime memory updates
- Team collaboration features
- Prompt history
- A chat interface
- LLM calls of any kind
- AI inference of any kind
- A database
- Telemetry
- Analytics
- Remote API calls

Direct corollary of spec §18 (Command-Line Interface): no CLI command other than `init` — no `status`, `update`, `doctor`, `context`, `explain`, or any other subcommand ships in v1.

Per spec §19, none of the above are rejected ideas — they are future products built on top of what v1 establishes, not features deferred within v1 itself.

---

## 8. Risks

- **Cross-platform path handling.** Path separators, case sensitivity, and symlink behavior differ across Windows, macOS, and Linux. Mitigation: all path logic centralized in the Scanner and Memory packages, never duplicated; cross-platform CI (REL-01) required before any release.
- **Framework detection false positives.** Detecting a framework that isn't actually in use (e.g. from a leftover dependency) produces misleading memory. Mitigation: detection requires direct, current evidence (SCAN-04); zero false positives is a release gate on the reference fixture set.
- **Framework/tooling detection false negatives.** A real stack going undetected produces an incomplete, misleading memory.json with no error signal. Mitigation: risk indicators (SCAN-09) surface detection gaps as evidence-based facts rather than failing silently; reference fixture set (REL-06) is deliberately diverse.
- **Atomic write failures.** A crash or permission error mid-write must never leave a partial or corrupt `.recall/`. Mitigation: write-then-rename atomic writes (MEM-04, CLI-03) are a release gate, not an optimization.
- **Template drift.** An agent template silently diverging from what its target assistant actually reads well degrades value without any test catching it. Mitigation: golden output tests (TPL-07) catch unintentional drift; intentional changes require an explicit golden-file update, creating a visible review point.
- **Large repository scan performance.** A very large repository (tens of thousands of files) could make the Scanner slow enough to violate the "fast" guarantee (spec §9). Mitigation: filesystem walker (SCAN-02) excludes dependency/build directories early; performance verified against a large fixture as part of REL-06.
- **npm package name availability.** The `recall` (or chosen) package name may already be taken or disputed on the npm registry, blocking `npx recall init` as specified. Mitigation: name reserved early, before Milestone 4 begins, not discovered at release time. Outcome: `recall` belongs to an unrelated package, so v1 ships as `recall-context` (`npx recall-context init`), which installs the `recall` command.
- **Monorepo/workspace edge cases.** Unusual workspace configurations (nested workspaces, non-standard manifests) could produce incorrect structure facts. Mitigation: workspace detection (SCAN-05) is evidence-based only; an unrecognized configuration produces a single-package result rather than a wrong guess.

---

## 9. Definition of Done

Recall v1 is finished when all of the following are true, simultaneously:

1. `npx recall-context init` succeeds against every repository in the reference fixture set, on Linux, macOS, and Windows.
2. The output for every successful run is exactly the six files defined in spec §12 — no more, no fewer, in every case.
3. Every generated agent file's content is fully traceable to `memory.json`, verified by the golden output test suite.
4. Ten consecutive runs against an unchanged repository produce byte-identical `memory.json` and agent files, on every supported platform.
5. A second `init` run without `--force` makes no change to disk; a second run with `--force` reproduces the first run's output exactly.
6. No test run, in any suite, makes a network call or modifies any file outside `.recall/`.
7. The published npm package installs and runs correctly via `npx recall-context init` from a machine with no prior local build artifacts.
8. README and CLI reference document exactly the command surface that ships — one command, one flag — with no undocumented behavior and no described behavior that doesn't exist.
9. A GitHub Release is published with a tag matching the npm version, and the post-publish smoke test (REL-08) has passed against the real published artifact.

When all nine are true, Recall v1 ships.

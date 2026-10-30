# recall-context

## 1.0.0

### Major Changes

- b6e674a: Recall v1: one command that initializes a repository's memory for AI coding assistants.

  - `recall init [path] [--force]` is now the entire CLI. It writes `.recall/memory.json` (Project Memory, with evidence for every entry) and `.recall/agents/{claude,codex,cursor,gemini,openai}.md`, and prints exactly `Scanning repository...`, `Detecting architecture...`, `Generating AI memory...`, `Done.`
  - The write is all-or-nothing, never follows a symlinked `.recall`, and touches nothing outside `.recall/`. Re-running without `--force` exits 4 and changes nothing.
  - Output is byte-identical for the same repository state on every machine, and nothing is read from the network.
  - New detection: Python, Go, and Rust repositories; Angular, Nuxt, Svelte/SvelteKit, Astro, Remix, React Native, Electron, Hono, and Koa; Bun, Poetry, uv, and Pipenv; Prettier and Biome; risk indicators for missing CI, tests, license, lockfile, and unignored `.env` files.

  Breaking: the v0.2 commands (`scan`, `update`, `status`, `explain`, `context`, `doctor`), their flags, and the v0.2 `.recall/` layout (`manifest.json`, `snapshots/`, `architecture.md`, …) are removed. Run `recall init --force` to replace a v0.2 `.recall/` directory.

## 0.2.1

### Patch Changes

- 9dbb9be: Show evidence-backed architecture context for single-package repositories when no workspace dependency edges exist. Recall now surfaces the detected project shape, frameworks, source entry points, and runtime imports instead of reporting that no architecture was detected.

---
'recall-context': minor
---

Add deterministic, local-first task-focused context ranking:

- `recall context --task "<description>"` now ranks which repository files an AI agent should read first using explainable lexical, symbol, workspace, and import-graph signals — no embeddings, no AI provider, no network access.
- `--json` output includes `task` and `rankedFiles`, exposing the full ranking evidence (`path`, `score`, and a `reasons` array) for tooling that wants it.
- Entry points that resolve to compiled output (e.g. `dist/index.js`) are now mapped back to their real TypeScript source, so agents are never told to read build artifacts.
- Internal workspace dependency edges are classified as runtime, development, optional, or peer instead of being collapsed together in the architecture summary.
- Repository snapshots now include a derived project profile (language, application type, repository type, frameworks), e.g. "TypeScript CLI monorepo".
- Ranking precision improvements: task terms that match nearly every file (generic ecosystem vocabulary like "package" or "npm") are weighted down relative to rare, specific terms, so genuinely relevant files are no longer crowded out by repository-wide noise.

All new snapshot fields are additive and optional; existing `.recall/` snapshots remain readable and are enriched on the next `recall update`.

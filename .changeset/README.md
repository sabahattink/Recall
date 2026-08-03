# Changesets

This directory is managed by [Changesets](https://github.com/changesets/changesets). Run `pnpm changeset` to record a change that should be released, and `pnpm version-packages` to apply pending changesets and bump versions.

`config.json`'s `baseBranch` currently points at `claude/recall-cli-build-nymjvl` because that is this repository's actual default branch today — no `main` branch exists yet (see [docs/roadmap.md](../docs/roadmap.md)). Update `baseBranch` (and the branch lists in `.github/workflows/ci.yml`/`release.yml`) to `main` once the repository adopts one as its permanent default.

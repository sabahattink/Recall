## Summary

<!-- What does this change do, and why? Which blueprint task or spec section does it implement? -->

## Related issue

<!-- Link any related issue(s), e.g. Closes #123 -->

## Test plan

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm verify:cli` (compiled CLI against every reference fixture)

## Checklist

- [ ] Every new or changed Fact carries evidence (`{ path, reason }`); nothing is guessed
- [ ] Nothing is written outside `.recall/`; no network access; no repository code is executed
- [ ] Output stays deterministic (no `localeCompare`, timestamps, absolute paths, or machine-specific values)
- [ ] Golden files changed only deliberately, and the diff is reviewed in this PR
- [ ] A changeset was added if this should be released (`pnpm changeset`)

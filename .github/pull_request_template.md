## Summary

<!-- What does this change do, and why? -->

## Related issue

<!-- Link any related issue(s), e.g. Closes #123 -->

## Test plan

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] Manually verified against a fixture, if applicable (`node apps/cli/dist/index.js <command> --path packages/test-fixtures/fixtures/<fixture>`)

## Checklist

- [ ] New/changed findings (risks, conventions, features) carry evidence (`{ path, reason }`)
- [ ] No source files outside `.recall/`, `.gitignore`, or an explicit output path are written
- [ ] Human-authored Markdown content outside the generated markers is preserved
- [ ] A changeset was added if this should be released (`pnpm changeset`)

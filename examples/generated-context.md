# Example: generated context output

This is **representative output**, not a benchmark or a guarantee of what Recall will detect in any specific repository. It shows the real shape of `recall context --task "..." --stdout`'s output (see [packages/memory/src/context.ts](../packages/memory/src/context.ts) for the generator), filled in for a fictional NestJS project called `paddle-billing-service`. No such repository exists — the file paths, risks, and conventions below are illustrative.

To see Recall's actual output against a real (small, fixture) project, run:

```bash
pnpm build
node apps/cli/dist/index.js init --path packages/test-fixtures/fixtures/nestjs
node apps/cli/dist/index.js context --path packages/test-fixtures/fixtures/nestjs --stdout
```

---

```markdown
# Recall Context: paddle-billing-service

_Generated for task: "Add password reset"_

## 1. Project summary

- Repository: paddle-billing-service
- Package manager: pnpm (monorepo)
- Primary frameworks: nestjs

## 2. Repository layout

- `apps/api` — app (paddle-billing-api)
- `packages/billing-core` — package (billing-core)
- `packages/auth` — package (auth)

## 3. Architecture

- `apps/api` → `packages/auth`
- `apps/api` → `packages/billing-core`
- `packages/billing-core` → `packages/auth`

## 4. Important conventions

- Controllers are suffixed `*.controller.ts` and colocated with their module
- DTOs are suffixed `*.dto.ts` and validated with `class-validator`
- ESLint + Prettier enforced via `pnpm lint`; no unformatted files on `main`

## 5. Primary entry points

- `apps/api/src/main.ts` (bootstrap)
- `apps/api/src/auth/auth.controller.ts` (controller)

## 6. Important commands

- `pnpm run start:dev`
- `pnpm run test`
- `pnpm run build`

## 7. Known risks

- [medium] `packages/auth/src/auth.service.ts` has no test file
- [low] Circular dependency between `billing-core` and `auth` at the module level

## 8. Technical debt

- `apps/api/src/billing/billing.service.ts` exceeds 400 lines with mixed responsibilities

## 9. Relevant decisions

- Unconfirmed: uses Paddle for external-service

## 10. Files an agent should read first

- `packages/auth/src/auth.controller.ts`
- `packages/auth/src/auth.service.ts`
- `packages/auth/src/dto/reset-password.dto.ts`

## 11. Files and directories an agent should avoid modifying

- `.recall/` — Recall-managed memory; edit only the human sections outside the generated markers
- `apps/api/src/generated/`

## 12. Current Git state

- Branch: main
- Commit: 4f2a9c1
- Working tree: clean
```

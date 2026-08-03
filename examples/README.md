# Examples

This directory doesn't duplicate example projects — representative fixture projects (a generic Node.js project, a NestJS project, a Next.js project, and a pnpm monorepo) already live under [`packages/test-fixtures/fixtures/`](../packages/test-fixtures/fixtures) and are used by Recall's own test suite, so they're guaranteed to stay in sync with what Recall actually detects.

Try Recall against any of them after building:

```bash
pnpm build

node apps/cli/dist/index.js init --path packages/test-fixtures/fixtures/simple-node
node apps/cli/dist/index.js init --path packages/test-fixtures/fixtures/nestjs
node apps/cli/dist/index.js init --path packages/test-fixtures/fixtures/nextjs
node apps/cli/dist/index.js init --path packages/test-fixtures/fixtures/pnpm-monorepo

node apps/cli/dist/index.js status --path packages/test-fixtures/fixtures/nestjs
node apps/cli/dist/index.js context --path packages/test-fixtures/fixtures/nestjs --stdout
```

Each `init` writes a `.recall/` directory into the fixture — inspect `.recall/architecture.md`, `.recall/features.md`, and `.recall/snapshots/latest.json` to see what Recall detected. These `.recall/` directories under `packages/test-fixtures/fixtures/` are ignored by Git (see the root `.gitignore`) so trying the CLI locally never creates a diff.

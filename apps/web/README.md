# recall-web

The Recall product website: landing page, documentation, changelog, roadmap, and examples.
Lives at `apps/web` inside the Recall pnpm/Turborepo monorepo — it is not a separate repository
and is never published to npm (`"private": true`).

## Purpose

- Product landing page (`/`)
- Documentation, powered by Fumadocs + MDX (`/docs`)
- Changelog, rendered from the repository's actual `CHANGELOG.md` (`/changelog`)
- Roadmap, rendered from the repository's actual `docs/roadmap.md` (`/roadmap`)
- CLI command examples (`/examples`)

This is a **foundation** sprint: structure, content wiring, theming, SEO scaffolding, and
accessibility basics. The final landing-page visual design is a deliberate follow-up (see
"Current scope and non-goals" below).

## Local development

From the repository root:

```bash
pnpm install
pnpm --filter recall-web dev
```

Or from `apps/web` directly:

```bash
pnpm dev
```

The dev server runs at `http://localhost:3000`.

## Build commands

```bash
pnpm build       # next build
pnpm start       # next start (serves the production build)
pnpm lint        # eslint src
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest run
pnpm clean       # removes .next, .source, dist, *.tsbuildinfo
```

All of these also run through the root Turborepo pipeline (`pnpm build`, `pnpm lint`,
`pnpm typecheck`, `pnpm test` from the repository root).

## Directory structure

```
apps/web/
├── content/docs/       # MDX documentation content
├── public/              # static assets (favicon, etc.)
├── src/
│   ├── app/              # Next.js App Router routes
│   │   ├── (marketing)/   # `/` landing page
│   │   ├── docs/           # Fumadocs-powered documentation routes
│   │   ├── examples/       # CLI command examples
│   │   ├── changelog/      # renders the repo's CHANGELOG.md
│   │   ├── roadmap/        # renders the repo's docs/roadmap.md
│   │   ├── api/search/      # Fumadocs static search endpoint
│   │   ├── layout.tsx, globals.css, not-found.tsx, robots.ts, sitemap.ts
│   ├── components/
│   │   ├── layout/    # header, footer, theme provider/toggle, mobile nav
│   │   ├── marketing/  # hero, command block, feature card
│   │   ├── docs/        # docs-specific components
│   │   └── ui/           # container, section, button primitives
│   ├── config/          # site.ts (single source of product identity/URLs), navigation.ts
│   ├── lib/              # utils, fumadocs source loader, metadata, markdown renderer
│   └── __tests__/        # site config / navigation / metadata assertions
├── source.config.ts     # Fumadocs MDX source definition
├── next.config.ts
├── postcss.config.mjs
├── tsconfig.json         # standalone Next.js config — does not extend the repo's tsconfig.base.json (see note below)
└── package.json
```

**Note on `tsconfig.json`:** unlike the Node.js packages under `packages/*`, `apps/web/tsconfig.json`
does not extend the repository's `tsconfig.base.json`. Next.js requires `moduleResolution: "bundler"`,
`noEmit: true`, and `jsx: "preserve"`, which conflict with the base config's Node-library-oriented
`composite`/`declaration`/`NodeNext` settings. This is a deliberate, standalone Next.js config.

## Content editing

- **Docs**: edit or add `.mdx` files under `content/docs/`, and list new pages in
  `content/docs/meta.json` to control sidebar order.
- **Changelog / roadmap**: edit the repository's root `CHANGELOG.md` / `docs/roadmap.md` directly
  — the web pages render those files at request time, so there is nothing to duplicate.
- **Site identity, URLs, naming**: edit `src/config/site.ts` only. Components and metadata read
  from it; nothing else should hard-code the domain, package name, or executable name.
- **Navigation**: edit `src/config/navigation.ts`.

## Relationship to the Recall CLI

This app is purely presentational — it has no runtime dependency on `apps/cli` or any
`@recall-ai/*` package, and building/publishing it never touches the `recall-context` npm
package. See [`docs/web-deployment.md`](../../docs/web-deployment.md) for the planned deployment.

## Current scope and non-goals

**In scope for this sprint:** routing structure, Fumadocs documentation, design tokens and
dark/light/system theming, SEO metadata (`robots.ts`, `sitemap.ts`, Open Graph, JSON-LD), and
accessible, restrained component foundations.

**Explicitly not in scope yet:**

- Final landing-page visual design (this sprint ships structural placeholders with real content,
  not final visuals).
- Analytics, cookies, or any tracking script.
- A paid/hosted search service (Fumadocs' static search is used instead).
- Blog content (the structure is meant to accommodate one later, but no blog exists yet).
- Deployment, DNS, or Vercel project creation (see `docs/web-deployment.md`).

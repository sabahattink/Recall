import type { ReactNode } from 'react';
import { Section } from '@/components/ui/section';
import { InlineCode } from '@/components/ui/inline-code';
import { SectionHeading } from './section-heading';

interface Stage {
  name: string;
  description: ReactNode;
  /** What the stage hands to the next one. */
  produces: string;
}

/** The five stages of docs/product-specification.md §14, in order. */
const stages: Stage[] = [
  {
    name: 'Repository',
    description: 'Your files, exactly as they are on disk. The only input.',
    produces: 'files on disk',
  },
  {
    name: 'Scanner',
    description:
      'Reads manifests, lockfiles, and configuration and records Facts: observations with evidence, never opinions. No evidence, no claim.',
    produces: 'Facts',
  },
  {
    name: 'Project Memory',
    description: 'Normalizes Facts into agent-independent knowledge, the single source of truth.',
    produces: 'memory.json',
  },
  {
    name: 'Agent Templates',
    description: (
      <>
        Render <InlineCode>memory.json</InlineCode> into each assistant&apos;s format. Templates
        format; they never read the repository.
      </>
    ),
    produces: 'agents/*.md',
  },
  {
    name: 'Disk',
    description: 'Writes the complete output at once, or nothing at all.',
    produces: '.recall/',
  },
];

interface DetectionRow {
  label: string;
  values: string;
}

const detections: DetectionRow[] = [
  { label: 'Languages', values: 'TypeScript, JavaScript, Python, Go, Rust' },
  {
    label: 'Frameworks',
    values:
      'Next.js, NestJS, React, Express, Fastify, Vue, Angular, Nuxt, Svelte and SvelteKit, Astro, Remix, React Native, Electron, Hono, Koa',
  },
  {
    label: 'Package managers',
    values: 'pnpm, npm, Yarn, Bun, pip, Poetry, uv, Pipenv, Go modules, Cargo',
  },
  { label: 'Monorepos', values: 'package.json workspaces, pnpm-workspace.yaml' },
];

/**
 * The pipeline as a segmented strip: hairline-divided cells on a single
 * bordered surface (design-system.md §7 — borders, no shadows, no hover,
 * since nothing here is clickable). Order is carried by the list semantics
 * and the stage numbers, not by decorative connectors.
 */
export function HowRecallWorksSection() {
  return (
    <Section aria-labelledby="how-it-works-heading">
      <SectionHeading id="how-it-works-heading" title="Five stages, in one direction.">
        Each stage consumes only the output of the stage before it. Nothing feeds back, nothing runs
        in the background, and every agent file comes from the same{' '}
        <InlineCode>memory.json</InlineCode>, so all five assistants read the same facts.
      </SectionHeading>

      <ol className="mt-10 grid gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-5">
        {stages.map((stage, index) => (
          <li key={stage.name} className="flex flex-col bg-card p-6">
            <span aria-hidden className="font-mono text-sm text-muted-foreground">
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3 className="mt-3 font-semibold text-foreground">{stage.name}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {stage.description}
            </p>
            <p className="mt-auto pt-5 font-mono text-sm text-foreground">
              <span aria-hidden className="select-none text-muted-foreground">
                →{' '}
              </span>
              <span className="sr-only">Produces: </span>
              {stage.produces}
            </p>
          </li>
        ))}
      </ol>

      <div className="mt-16">
        <h3 className="font-semibold text-foreground">Recognized today</h3>
        <dl className="mt-4 divide-y divide-border border-t border-border text-sm">
          {detections.map((row) => (
            <div key={row.label} className="grid gap-1 py-4 sm:grid-cols-[200px_1fr] sm:gap-8">
              <dt className="font-medium text-foreground">{row.label}</dt>
              <dd className="leading-relaxed text-muted-foreground">{row.values}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Section>
  );
}

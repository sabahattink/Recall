import { Fragment } from 'react';
import { Section } from '@/components/ui/section';

interface Step {
  number: string;
  title: string;
  description: string;
}

const steps: Step[] = [
  {
    number: '01',
    title: 'Scan Repository',
    description: 'Analyze project structure, frameworks, dependencies and conventions.',
  },
  {
    number: '02',
    title: 'Build Memory',
    description: 'Generate architecture, decisions, conventions, risks and technical debt.',
  },
  {
    number: '03',
    title: 'Understand Task',
    description: 'Rank the most relevant files for the current request.',
  },
  {
    number: '04',
    title: 'Provide Context',
    description: 'Produce deterministic context that any coding agent can immediately use.',
  },
];

// Reused verbatim from HeroTerminal and ProblemSection's "With Recall" card
// — not new content, just referenced again at the point where it's actually
// produced.
const memoryCategories = ['Architecture', 'Conventions', 'Decisions', 'Risks', 'Technical debt'];

/**
 * One equally-sized step in the flow. Real headings (h3) carry the
 * accessible structure — connectors between cards are purely decorative
 * (design-system.md §7 card rules: border, bg-card, no shadow, no hover,
 * since these aren't clickable).
 */
function StepCard({ step }: { step: Step }) {
  return (
    <div className="flex-1 rounded-lg border border-border bg-card p-6">
      <span className="font-mono text-sm text-muted-foreground">{step.number}</span>
      <h3 className="mt-3 text-sm font-semibold text-foreground">{step.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
    </div>
  );
}

/**
 * A single hairline connecting adjacent steps — vertical when stacked
 * (mobile), horizontal in the row (desktop). Decorative only: the real
 * sequence is already conveyed by the step numbers and heading order.
 *
 * On desktop the line is pinned to a fixed offset (card padding + half the
 * step numeral's line-height: 24px + 10px) rather than centered against
 * whichever card happens to be tallest — so it runs precisely through the
 * numerals themselves regardless of how much a description wraps, instead
 * of landing at an approximate row-center.
 */
function StepConnector() {
  return (
    <div
      aria-hidden
      className="h-6 w-px self-center bg-border lg:mt-[34px] lg:h-px lg:w-10 lg:flex-none lg:self-start"
    />
  );
}

/**
 * A borderless data-flow line, not another terminal: the step cards above
 * already show the four *stages* of the process, so this deliberately
 * avoids repeating that same "boxes + connectors" grammar, and avoids
 * repeating the Hero's own `$ recall context` terminal a second time in the
 * same visit. Instead it states the *transformation* as plain, precise
 * typography — repository in, structured memory in the middle, coding
 * agent out — closer to a type signature or a pipeline notation than a UI
 * pattern. Every label is reused verbatim from elsewhere on the page; no
 * new copy.
 */
function MemoryFlow() {
  return (
    <div
      role="img"
      aria-label="Repository transforms into structured memory — architecture, conventions, decisions, risks, and technical debt — which becomes available to the coding agent. Context ready."
    >
      <div
        aria-hidden
        className="flex flex-col gap-x-3 gap-y-2 font-mono text-sm sm:flex-row sm:flex-wrap sm:items-baseline"
      >
        <span className="text-foreground">Repository</span>
        <span className="text-muted-foreground">→</span>
        <span className="text-muted-foreground">{memoryCategories.join(' · ')}</span>
        <span className="text-muted-foreground">→</span>
        <span className="text-foreground">Coding agent</span>
      </div>
      <p aria-hidden className="mt-3 text-sm text-muted-foreground">
        Context ready.
      </p>
    </div>
  );
}

export function HowRecallWorksSection() {
  return (
    <Section aria-labelledby="how-recall-works-heading">
      <h2
        id="how-recall-works-heading"
        className="text-2xl font-semibold tracking-tight text-foreground"
      >
        How Recall works
      </h2>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Recall analyzes your repository once, builds a structured project memory, and gives every
        future AI session immediate access to the parts of the codebase that matter.
      </p>

      <div className="mt-10 flex flex-col lg:flex-row">
        {steps.map((step, index) => (
          <Fragment key={step.number}>
            <StepCard step={step} />
            {index < steps.length - 1 ? <StepConnector /> : null}
          </Fragment>
        ))}
      </div>

      <div className="mt-10">
        <MemoryFlow />
      </div>
    </Section>
  );
}

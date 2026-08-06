import { Fragment } from 'react';
import { Check } from 'lucide-react';
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

const workflowOutput = [
  'Ranked relevant files',
  'Loaded architecture',
  'Loaded conventions',
  'Context ready',
];

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

/** Matches HeroTerminal's visual treatment exactly (design-system.md §8: no fake chrome, no typing animation), constrained narrower to read as a compact confirmation rather than a second hero. */
function WorkflowTerminal() {
  return (
    <div
      className="w-full max-w-xl rounded-md border border-border bg-code-background p-6 font-mono text-sm"
      role="img"
      aria-label='Terminal output: recall context --task "Add password reset" reports ranked relevant files, loaded architecture, loaded conventions, and context ready.'
    >
      <p aria-hidden className="text-foreground">
        <span className="select-none text-muted-foreground">$ </span>
        recall context \
      </p>
      <p aria-hidden className="pl-4 text-foreground">
        --task &quot;Add password reset&quot;
      </p>

      <ul aria-hidden className="mt-5 flex flex-col gap-2">
        {workflowOutput.map((line) => (
          <li key={line} className="flex items-center gap-2 text-foreground">
            <Check className="h-3.5 w-3.5 shrink-0 text-success" />
            {line}
          </li>
        ))}
      </ul>
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
        <WorkflowTerminal />
      </div>
    </Section>
  );
}

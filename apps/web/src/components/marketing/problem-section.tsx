import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Section } from '@/components/ui/section';
import { cn } from '@/lib/utils';

const disappearingContext = [
  'Architecture decisions.',
  'Naming conventions.',
  'Important dependencies.',
  'Project history.',
  'Previous trade-offs.',
];

const transcript = [
  { speaker: 'Developer', message: 'How does authentication work?' },
  { speaker: 'Agent', message: 'I do not know this repository yet.' },
  {
    speaker: 'Agent',
    message: 'Can you explain the architecture, conventions, and relevant files?',
  },
];

const availableMemory = ['Architecture', 'Conventions', 'Decisions', 'Risks', 'Technical debt'];

interface ComparisonCardProps {
  title: string;
  children: ReactNode;
  /**
   * "Without Recall" renders its title in muted-foreground rather than
   * foreground — a deliberate, tokens-only hierarchy choice (§4 rule 3:
   * "Color, not size, is the secondary hierarchy signal") that reads the
   * left column as the gap being described and the right column as the
   * resolution, without introducing any new color or icon.
   */
  muted?: boolean;
}

/** Shared card shell for the two comparison columns — same border/padding/radius as every other card on the site (design-system.md §7), never clickable, so no hover state. */
function ComparisonCard({ title, children, muted }: ComparisonCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3
        className={cn('text-sm font-semibold', muted ? 'text-muted-foreground' : 'text-foreground')}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

export function ProblemSection() {
  return (
    <Section aria-labelledby="context-loss-heading">
      <div className="max-w-2xl">
        <h2
          id="context-loss-heading"
          className="text-2xl font-semibold tracking-tight text-foreground"
        >
          Every new session starts here.
        </h2>

        <p className="mt-3 text-muted-foreground">
          Most coding agents only know what you paste into the current conversation.
        </p>

        <ul className="mt-4 flex flex-col gap-1 text-muted-foreground">
          {disappearingContext.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <p className="mt-6 text-muted-foreground">They disappear.</p>
        <p className="mt-1 text-muted-foreground">So every new session starts from zero.</p>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <ComparisonCard title="Without Recall" muted>
          <div className="mt-4 flex flex-col gap-4">
            {transcript.map((turn, index) => (
              <div key={index}>
                <p className="text-sm text-muted-foreground">{turn.speaker}:</p>
                <p className="mt-1 text-sm text-foreground">{turn.message}</p>
              </div>
            ))}
          </div>
        </ComparisonCard>

        <ComparisonCard title="With Recall">
          <ul className="mt-4 flex flex-col gap-2">
            {availableMemory.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-foreground">
                <Check aria-hidden className="h-3.5 w-3.5 shrink-0 text-success" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">Context ready.</p>
        </ComparisonCard>
      </div>

      <p className="mx-auto mt-10 max-w-xl text-center text-muted-foreground">
        Recall does not replace the coding agent.
        <br />
        It gives the agent the repository context it did not have.
      </p>
    </Section>
  );
}

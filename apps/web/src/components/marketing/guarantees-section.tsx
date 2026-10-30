import type { ReactNode } from 'react';
import { Section } from '@/components/ui/section';
import { InlineCode } from '@/components/ui/inline-code';
import { SectionHeading } from './section-heading';

interface Guarantee {
  title: ReactNode;
  description: ReactNode;
}

/** docs/product-specification.md §20, plus the first-run promises of §11. */
const guarantees: Guarantee[] = [
  {
    title: 'No network access',
    description: 'Works entirely offline, from what is already on disk.',
  },
  {
    title: 'Never runs your code',
    description: 'Reads files. Never runs the repository’s code, tests, build, or scripts.',
  },
  {
    title: (
      <>
        Writes only <InlineCode>.recall/</InlineCode>
      </>
    ),
    description: 'Nothing outside it is created, modified, or deleted.',
  },
  {
    title: 'Deterministic',
    description: 'The same repository state produces byte-identical output, on any machine.',
  },
  {
    title: 'Idempotent',
    description: (
      <>
        An existing <InlineCode>.recall/</InlineCode> is never touched without{' '}
        <InlineCode>--force</InlineCode>. On an unchanged repository,{' '}
        <InlineCode>--force</InlineCode> writes the same bytes again.
      </>
    ),
  },
  {
    title: 'All or nothing',
    description: (
      <>
        Either the complete <InlineCode>.recall/</InlineCode> is written, or nothing is. Never a
        partial result.
      </>
    ),
  },
  {
    title: 'No account, no API key',
    description: 'Nothing to sign up for, nothing to configure before the first run.',
  },
  {
    title: 'No CLI telemetry, no LLM calls',
    description:
      'The CLI reports nothing anywhere and no model is involved. Every fact in the output comes from a file in your repository. This website is a separate application.',
  },
];

export function GuaranteesSection() {
  return (
    <Section aria-labelledby="guarantees-heading">
      <SectionHeading id="guarantees-heading" title="Guarantees, not settings.">
        These hold on every run of <InlineCode>recall init</InlineCode>. None of them is an option,
        so none of them can be turned off.
      </SectionHeading>

      <ul className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {guarantees.map((guarantee, index) => (
          <li key={index} className="border-t border-border pt-5">
            <h3 className="font-semibold text-foreground">{guarantee.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {guarantee.description}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

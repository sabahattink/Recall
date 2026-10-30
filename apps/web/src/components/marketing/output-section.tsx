import type { ReactNode } from 'react';
import { outputTree } from '@/config/product';
import { Section } from '@/components/ui/section';
import { InlineCode } from '@/components/ui/inline-code';
import { CodePanel } from './code-panel';
import { SectionHeading } from './section-heading';

interface OutputEntry {
  term: ReactNode;
  description: ReactNode;
}

const entries: OutputEntry[] = [
  {
    term: <InlineCode>memory.json</InlineCode>,
    description: (
      <>
        Project Memory, the single source of truth: metadata, stack, architecture, structure,
        commands, conventions, dependencies, and risks. Every entry carries the evidence it was
        derived from.
      </>
    ),
  },
  {
    term: <InlineCode>agents/*.md</InlineCode>,
    description: (
      <>
        Five read-only renderings of <InlineCode>memory.json</InlineCode>, one per assistant, each
        in the shape that assistant reads. An agent file never says anything{' '}
        <InlineCode>memory.json</InlineCode> doesn&apos;t.
      </>
    ),
  },
  {
    term: 'Nothing else',
    description: (
      <>
        No cache, no snapshot history, no hidden metadata. Nothing outside{' '}
        <InlineCode>.recall/</InlineCode> is created or changed.
      </>
    ),
  },
];

export function OutputSection() {
  return (
    <Section aria-labelledby="output-heading">
      <SectionHeading id="output-heading" title="One command. One directory.">
        <InlineCode>recall init</InlineCode> writes exactly six files, all inside{' '}
        <InlineCode>.recall/</InlineCode>.
      </SectionHeading>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-16">
        <CodePanel
          label="Written by recall init"
          copyText={outputTree}
          copyLabel="Copy directory tree"
        >
          {outputTree}
        </CodePanel>

        <dl className="flex flex-col gap-8">
          {entries.map((entry, index) => (
            <div key={index} className="border-t border-border pt-5 first:border-0 first:pt-0">
              <dt className="font-semibold text-foreground">{entry.term}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {entry.description}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Section>
  );
}

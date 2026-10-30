import type { ReactNode } from 'react';
import { Section } from '@/components/ui/section';
import { InlineCode } from '@/components/ui/inline-code';
import { CodePanel } from './code-panel';
import { SectionHeading } from './section-heading';

interface ComparisonRow {
  aspect: string;
  handWritten: string;
  recall: ReactNode;
}

const HAND_WRITTEN_LABEL = 'Hand-written CLAUDE.md / AGENTS.md';
const RECALL_LABEL = 'Recall';

const rows: ComparisonRow[] = [
  {
    aspect: 'Written by',
    handWritten: 'A person, by hand',
    recall: 'Generated from the repository’s own files',
  },
  {
    aspect: 'Holds',
    handWritten: 'Intent, team rules, and context no file records',
    recall: 'Stack, layout, commands, conventions, dependencies, and risks',
  },
  {
    aspect: 'Sources',
    handWritten: 'Usually not recorded',
    recall: 'Every entry cites the file it came from',
  },
  {
    aspect: 'Across assistants',
    handWritten: 'Typically one file per tool, each maintained on its own',
    recall: (
      <>
        One <InlineCode>memory.json</InlineCode>, rendered for five assistants
      </>
    ),
  },
];

/** A team's own hand-written rules — illustrative only. */
const OWN_RULES = '# Team rules\nUse conventional commits. Ask before adding a dependency.\n\n';
const RECALL_IMPORT = '@.recall/agents/claude.md';
const claudeMdExample = OWN_RULES + RECALL_IMPORT;

/**
 * Recall versus hand-authored instruction files, stated honestly: they hold
 * different kinds of knowledge and are used together. Rendered as a real
 * table from the small breakpoint up, and as the same data stacked on
 * mobile, so the page never scrolls horizontally (design-system.md §14).
 */
export function ComparisonSection() {
  return (
    <Section aria-labelledby="comparison-heading">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-16">
        <SectionHeading
          id="comparison-heading"
          title="Alongside CLAUDE.md and AGENTS.md, not instead of them."
        >
          Your hand-written instruction files hold what only your team knows. Recall holds what the
          repository can prove. Keep both: one line imports Recall&apos;s memory into the file you
          already maintain.
        </SectionHeading>

        <CodePanel label="CLAUDE.md" copyText={claudeMdExample} copyLabel="Copy CLAUDE.md example">
          <span className="text-muted-foreground">{OWN_RULES}</span>
          {RECALL_IMPORT}
        </CodePanel>
      </div>

      <table className="mt-12 hidden w-full border-collapse text-left text-sm sm:table">
        <thead>
          <tr className="border-b border-border">
            <td className="w-1/5 py-3 pr-6" />
            <th scope="col" className="w-2/5 py-3 pr-6 font-medium text-muted-foreground">
              {HAND_WRITTEN_LABEL}
            </th>
            <th scope="col" className="w-2/5 py-3 font-medium text-foreground">
              {RECALL_LABEL}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.aspect} className="border-b border-border last:border-0">
              <th scope="row" className="py-4 pr-6 align-top font-medium text-foreground">
                {row.aspect}
              </th>
              <td className="py-4 pr-6 align-top leading-relaxed text-muted-foreground">
                {row.handWritten}
              </td>
              <td className="py-4 align-top leading-relaxed text-foreground">{row.recall}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-12 divide-y divide-border border-t border-border text-sm sm:hidden">
        {rows.map((row) => (
          <div key={row.aspect} className="flex flex-col gap-3 py-5">
            <dt className="font-medium text-foreground">{row.aspect}</dt>
            <dd className="leading-relaxed text-foreground">
              <span className="block text-muted-foreground">{HAND_WRITTEN_LABEL}</span>
              {row.handWritten}
            </dd>
            <dd className="leading-relaxed text-foreground">
              <span className="block text-muted-foreground">{RECALL_LABEL}</span>
              {row.recall}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

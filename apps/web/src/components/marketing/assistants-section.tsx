import type { ReactNode } from 'react';
import { Section } from '@/components/ui/section';
import { InlineCode } from '@/components/ui/inline-code';
import { SectionHeading } from './section-heading';

interface AssistantRow {
  assistant: string;
  file: string;
  setup: ReactNode;
}

const assistants: AssistantRow[] = [
  {
    assistant: 'Claude Code',
    file: '.recall/agents/claude.md',
    setup: (
      <>
        Add <InlineCode>@.recall/agents/claude.md</InlineCode> to your{' '}
        <InlineCode>CLAUDE.md</InlineCode>. Claude Code follows @-imports, so the file loads with
        every session.
      </>
    ),
  },
  {
    assistant: 'Codex',
    file: '.recall/agents/codex.md',
    setup: (
      <>
        Written in <InlineCode>AGENTS.md</InlineCode> style. Copy it to{' '}
        <InlineCode>AGENTS.md</InlineCode>, or reference it from the one you already have.
      </>
    ),
  },
  {
    assistant: 'Cursor',
    file: '.recall/agents/cursor.md',
    setup: (
      <>
        Starts with Cursor rule (MDC) front matter. Copy it to{' '}
        <InlineCode>.cursor/rules/recall.mdc</InlineCode>.
      </>
    ),
  },
  {
    assistant: 'Gemini CLI',
    file: '.recall/agents/gemini.md',
    setup: (
      <>
        Add <InlineCode>@.recall/agents/gemini.md</InlineCode> to your{' '}
        <InlineCode>GEMINI.md</InlineCode>.
      </>
    ),
  },
  {
    assistant: 'ChatGPT / OpenAI',
    file: '.recall/agents/openai.md',
    setup: "Paste it into a ChatGPT Project's instructions, or use it as an API system prompt.",
  },
];

export function AssistantsSection() {
  return (
    <Section aria-labelledby="assistants-heading">
      <SectionHeading id="assistants-heading" title="Each assistant gets a file it already reads.">
        Every file in <InlineCode>.recall/agents/</InlineCode> follows the conventions of one
        assistant. Connecting one is a single step you take once: an import line, a copy, or a
        paste.
      </SectionHeading>

      <ul className="mt-10 divide-y divide-border border-y border-border">
        {assistants.map((row) => (
          <li
            key={row.assistant}
            className="grid gap-2 py-6 md:grid-cols-[minmax(0,10rem)_minmax(0,14rem)_minmax(0,1fr)] md:gap-8"
          >
            <h3 className="font-semibold text-foreground">{row.assistant}</h3>
            <p className="font-mono text-sm leading-6 text-foreground [overflow-wrap:anywhere]">
              {row.file}
            </p>
            <p className="text-sm leading-6 text-muted-foreground">{row.setup}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

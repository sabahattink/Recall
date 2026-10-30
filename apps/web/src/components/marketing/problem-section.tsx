import { Section } from '@/components/ui/section';
import { InlineCode } from '@/components/ui/inline-code';
import { SectionHeading } from './section-heading';

interface RepeatedQuestion {
  question: string;
  /** Where `memory.json` answers it. */
  keys: string[];
}

const repeatedQuestions: RepeatedQuestion[] = [
  { question: 'What is this built with?', keys: ['stack.languages', 'stack.frameworks'] },
  { question: 'pnpm, npm, or Yarn?', keys: ['stack.packageManagers'] },
  { question: 'How do I run the tests?', keys: ['commands', 'conventions.testing'] },
  { question: 'Is this a monorepo?', keys: ['architecture.layout'] },
  { question: 'Where is the source? Where are the tests?', keys: ['structure.directories'] },
  { question: 'What does it depend on?', keys: ['dependencies'] },
  { question: 'Anything I should be careful with?', keys: ['risks'] },
];

/**
 * The problem stated as the literal questions a developer re-answers, each
 * paired with the `memory.json` key that answers it — a factual mapping
 * rather than an adjective (design-system.md §2, principle 5).
 */
export function ProblemSection() {
  return (
    <Section aria-labelledby="problem-heading">
      <SectionHeading id="problem-heading" title="Every session starts from zero.">
        A new session in Claude Code, Codex, Cursor, Gemini CLI, or ChatGPT knows nothing about your
        repository. So you explain it again: the stack, the layout, the commands. Tomorrow you
        explain it again, to a different assistant.
      </SectionHeading>

      <div className="mt-10 text-sm">
        <div
          aria-hidden
          className="grid gap-1 border-b border-border pb-3 font-medium text-muted-foreground sm:grid-cols-2 sm:gap-8"
        >
          <span>The question you keep answering</span>
          <span>
            Answered once, in <span className="font-mono">memory.json</span>
          </span>
        </div>
        <dl className="divide-y divide-border">
          {repeatedQuestions.map((row) => (
            <div key={row.question} className="grid gap-2 py-4 sm:grid-cols-2 sm:gap-8">
              <dt className="text-foreground">{row.question}</dt>
              <dd className="flex flex-wrap gap-2">
                <span className="sr-only">Answered in memory.json by </span>
                {row.keys.map((key) => (
                  <InlineCode key={key}>{key}</InlineCode>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Section>
  );
}

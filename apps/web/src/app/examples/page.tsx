import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui/container';
import { CommandBlock } from '@/components/marketing/command-block';

export const metadata: Metadata = {
  title: 'Examples',
  description: 'Command examples for the Recall CLI.',
};

const examples = [
  {
    title: 'Initialize Recall in a repository',
    description: 'Analyzes the repository and creates the `.recall/` memory directory.',
    command: 'recall init',
  },
  {
    title: 'Generate context for a specific task',
    description: 'Ranks and surfaces the files most relevant to a task, with explainable evidence.',
    command: 'recall context --task "Fix password reset controller" --stdout',
  },
  {
    title: 'Check whether memory is up to date',
    description: 'Reports whether `.recall/` reflects the current state of the repository.',
    command: 'recall status',
  },
  {
    title: 'Explain a file or directory',
    description: "Explains a path's role in the repository.",
    command: 'recall explain src/auth/password-reset.controller.ts',
  },
  {
    title: 'Refresh memory after changes',
    description: 'Re-runs analysis and updates `.recall/` from the current repository state.',
    command: 'recall update',
  },
  {
    title: 'Validate the environment',
    description: 'Checks the Recall installation and memory state for problems.',
    command: 'recall doctor',
  },
];

export default function ExamplesPage() {
  return (
    <Container className="py-16 sm:py-20">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Examples</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        A selection of real Recall commands. See the{' '}
        <Link href="/docs/commands" className="underline underline-offset-4">
          commands reference
        </Link>{' '}
        for every flag and exit code.
      </p>

      <div className="mt-10 flex flex-col gap-8">
        {examples.map((example) => (
          <div key={example.command}>
            <h2 className="text-sm font-semibold text-foreground">{example.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{example.description}</p>
            <CommandBlock command={example.command} className="mt-3 max-w-xl" />
          </div>
        ))}
      </div>
    </Container>
  );
}

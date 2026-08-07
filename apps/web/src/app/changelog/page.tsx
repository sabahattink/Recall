import type { Metadata } from 'next';
import { Container } from '@/components/ui/container';
import { renderSimpleMarkdown } from '@/lib/simple-markdown';
import { readChangelogMarkdown } from '@/lib/read-repo-markdown';

export const metadata: Metadata = {
  title: 'Changelog',
  description: 'Release notes for the recall-context npm package.',
};

export default async function ChangelogPage() {
  const markdown = await readChangelogMarkdown();

  return (
    <Container className="py-16 sm:py-20">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Changelog</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Release notes for the published{' '}
        <code className="rounded bg-code-background px-1 py-0.5 font-mono text-sm">
          recall-context
        </code>{' '}
        npm package.
      </p>
      <div className="mt-10 max-w-2xl">{renderSimpleMarkdown(markdown)}</div>
    </Container>
  );
}

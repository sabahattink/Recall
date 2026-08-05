import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Metadata } from 'next';
import { Container } from '@/components/ui/container';
import { renderSimpleMarkdown } from '@/lib/simple-markdown';

export const metadata: Metadata = {
  title: 'Changelog',
  description: 'Release notes for the recall-context npm package.',
};

// Reads the repository's actual CHANGELOG.md rather than duplicating it, so
// this page can never drift from the real release notes.
async function getChangelog(): Promise<string> {
  const path = join(process.cwd(), '..', '..', 'CHANGELOG.md');
  return readFile(path, 'utf8');
}

export default async function ChangelogPage() {
  const markdown = await getChangelog();

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

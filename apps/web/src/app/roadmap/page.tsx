import type { Metadata } from 'next';
import { Container } from '@/components/ui/container';
import { renderSimpleMarkdown } from '@/lib/simple-markdown';
import { readRoadmapMarkdown } from '@/lib/read-repo-markdown';

export const metadata: Metadata = {
  title: 'Roadmap',
  description: 'What is in scope, deferred, and planned for Recall.',
};

export default async function RoadmapPage() {
  const markdown = await readRoadmapMarkdown();

  return (
    <Container className="py-16 sm:py-20">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Roadmap</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        What&apos;s deliberately deferred and what&apos;s planned next. Not a commitment to a
        timeline.
      </p>
      <div className="mt-10 max-w-2xl">{renderSimpleMarkdown(markdown)}</div>
    </Container>
  );
}

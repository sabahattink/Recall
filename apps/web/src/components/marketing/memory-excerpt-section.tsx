import Link from 'next/link';
import { memoryTopLevelKeys } from '@/config/product';
import { formatJson } from '@/lib/format-json';
import { Section } from '@/components/ui/section';
import { InlineCode } from '@/components/ui/inline-code';
import { CodePanel } from './code-panel';
import { JsonCode } from './json-code';
import { SectionHeading } from './section-heading';

/** Column budget for the excerpt: fits the full container width without scrolling. */
const EXCERPT_WIDTH = 100;

/**
 * An abridged `memory.json`. Field names, nesting, and evidence reasons
 * follow the memory.json schema (version 1.0.0) and the Scanner's own
 * reason strings; values describe a hypothetical Next.js repository.
 * Serialized by `formatJson`, so the excerpt is always valid JSON.
 */
const excerpt = {
  schemaVersion: '1.0.0',
  stack: {
    frameworks: [
      {
        name: 'nextjs',
        evidence: [
          { path: 'next.config.ts', reason: 'next.config.ts present' },
          { path: 'package.json', reason: 'dependency "next" declared' },
        ],
      },
    ],
  },
  commands: [
    {
      name: 'test',
      command: 'vitest run',
      evidence: [{ path: 'package.json', reason: 'scripts.test declared as "vitest run"' }],
    },
  ],
  risks: [
    {
      id: 'env-file-not-ignored',
      description:
        'Environment files are not ignored by the root .gitignore and may contain secrets.',
      evidence: [{ path: '.env.local', reason: 'present and not matched by .gitignore' }],
    },
  ],
};

const excerptSource = formatJson(excerpt, EXCERPT_WIDTH);

export function MemoryExcerptSection() {
  return (
    <Section aria-labelledby="evidence-heading">
      <SectionHeading id="evidence-heading" title="Every claim cites a file.">
        Each entry in <InlineCode>memory.json</InlineCode> carries an{' '}
        <InlineCode>evidence</InlineCode> list: the path that justifies it, and why. When the
        Scanner finds no evidence, it makes no claim. The agent files are rendered from this
        document and nothing else, so anything an assistant reads in them traces back to a file in
        your repository.
      </SectionHeading>

      <CodePanel
        label="memory.json — excerpt"
        copyText={excerptSource}
        copyLabel="Copy memory.json excerpt"
        className="mt-10"
      >
        <JsonCode source={excerptSource} />
      </CodePanel>

      <div className="mt-6 flex flex-col gap-4 text-sm text-muted-foreground lg:flex-row lg:items-baseline lg:justify-between lg:gap-8">
        <p className="leading-relaxed">
          Top-level keys:{' '}
          {memoryTopLevelKeys.map((key, index) => (
            <span key={key}>
              <InlineCode>{key}</InlineCode>
              {index < memoryTopLevelKeys.length - 1 ? ', ' : '.'}
            </span>
          ))}
        </p>
        <Link
          href="/docs/output-format"
          className="shrink-0 font-medium text-foreground underline underline-offset-4 transition-colors hover:text-muted-foreground"
        >
          Read the output format
          <span aria-hidden> →</span>
        </Link>
      </div>
    </Section>
  );
}

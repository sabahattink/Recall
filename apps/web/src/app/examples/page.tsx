import type { Metadata } from 'next';
import Link from 'next/link';
import { siteConfig } from '@/config/site';
import { Container } from '@/components/ui/container';
import { InlineCode } from '@/components/ui/inline-code';
import { CodePanel } from '@/components/marketing/code-panel';
import { JsonCode } from '@/components/marketing/json-code';
import { recallOutputFiles } from '@/lib/read-repo-markdown';

export const metadata: Metadata = {
  title: 'Example output',
  description:
    "Recall's own repository, initialized by Recall: the real memory.json and agent files, unedited.",
};

/** What each file is for, keyed by its path inside `.recall/`. */
const FILE_NOTES: Record<(typeof recallOutputFiles)[number]['path'], string> = {
  'agents/claude.md': 'Claude Code — imported from CLAUDE.md with @.recall/agents/claude.md.',
  'agents/codex.md': 'OpenAI Codex — written in AGENTS.md style.',
  'agents/cursor.md':
    'Cursor — starts with project-rule front matter, for .cursor/rules/recall.mdc.',
  'agents/gemini.md': 'Gemini CLI — imported from GEMINI.md with @.recall/agents/gemini.md.',
  'agents/openai.md':
    'ChatGPT / OpenAI — compact, for a Project’s instructions or a system prompt.',
  'memory.json': 'Project Memory — the single source of truth every file above is rendered from.',
};

const OPEN_BY_DEFAULT = 'agents/claude.md';

export default async function ExamplesPage() {
  const files = await Promise.all(
    recallOutputFiles.map(async (file) => ({ path: file.path, contents: await file.read() })),
  );

  return (
    <Container className="py-16 sm:py-20">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Example output</h1>
      <div className="mt-4 max-w-2xl space-y-4 leading-relaxed text-muted-foreground">
        <p>
          This is Recall&apos;s own repository, initialized by Recall. Every file below is the
          committed <InlineCode>.recall/</InlineCode> directory at the root of{' '}
          <a
            href={siteConfig.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-4"
          >
            the Recall repository
          </a>
          , read at build time — nothing on this page is written by hand.
        </p>
        <p>
          It was produced by exactly one command, <InlineCode>{siteConfig.initCommand}</InlineCode>.
          See the{' '}
          <Link href="/docs/output-format" className="text-foreground underline underline-offset-4">
            output format
          </Link>{' '}
          for what every field means.
        </p>
      </div>

      <div className="mt-12 flex flex-col gap-4">
        {files.map((file) => (
          <details
            key={file.path}
            open={file.path === OPEN_BY_DEFAULT}
            className="group rounded-md border border-border"
          >
            <summary className="flex cursor-pointer list-none flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
              <span className="font-mono text-sm text-foreground">.recall/{file.path}</span>
              <span className="text-sm text-muted-foreground">{FILE_NOTES[file.path]}</span>
            </summary>
            <CodePanel
              label={`${file.contents.split('\n').length - 1} lines`}
              copyText={file.contents}
              copyLabel={`Copy ${file.path}`}
              className="m-2 mt-0 max-h-[36rem] overflow-y-auto"
            >
              {file.path.endsWith('.json') ? <JsonCode source={file.contents} /> : file.contents}
            </CodePanel>
          </details>
        ))}
      </div>
    </Container>
  );
}

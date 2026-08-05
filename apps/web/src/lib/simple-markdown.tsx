import { Fragment, type ReactNode } from 'react';

/**
 * A deliberately minimal Markdown-to-JSX renderer for repository documents
 * (CHANGELOG.md, docs/roadmap.md) rendered as plain server-rendered pages —
 * headings, paragraphs, unordered lists, and fenced code blocks only. This
 * keeps those pages sourced directly from the actual repository file
 * (single source of truth, never duplicated/copy-pasted) without pulling in
 * a full Markdown/MDX pipeline for two simple pages.
 */
export function renderSimpleMarkdown(markdown: string): ReactNode {
  const lines = markdown.split('\n');
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let codeLines: string[] | null = null;
  let key = 0;

  function flushList() {
    if (listItems.length > 0) {
      blocks.push(
        <ul key={key++} className="list-disc space-y-1 pl-6 text-muted-foreground">
          {listItems.map((item, i) => (
            <li key={i}>{inline(item)}</li>
          ))}
        </ul>,
      );
      listItems = [];
    }
  }

  function inline(text: string): ReactNode {
    const parts = text.split(/(`[^`]+`)/g);
    return parts.map((part, i) =>
      part.startsWith('`') && part.endsWith('`') ? (
        <code key={i} className="rounded bg-code-background px-1 py-0.5 font-mono text-sm">
          {part.slice(1, -1)}
        </code>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      ),
    );
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');

    if (line.startsWith('```')) {
      if (codeLines === null) {
        codeLines = [];
      } else {
        blocks.push(
          <pre
            key={key++}
            className="overflow-x-auto rounded-md border border-border bg-code-background p-4 font-mono text-sm"
          >
            <code>{codeLines.join('\n')}</code>
          </pre>,
        );
        codeLines = null;
      }
      continue;
    }
    if (codeLines !== null) {
      codeLines.push(line);
      continue;
    }

    if (line.startsWith('## ')) {
      flushList();
      blocks.push(
        <h2 key={key++} className="mt-10 text-xl font-semibold tracking-tight text-foreground">
          {inline(line.slice(3))}
        </h2>,
      );
    } else if (line.startsWith('### ')) {
      flushList();
      blocks.push(
        <h3 key={key++} className="mt-6 text-base font-semibold text-foreground">
          {inline(line.slice(4))}
        </h3>,
      );
    } else if (line.startsWith('# ')) {
      flushList();
      // The document's own top-level heading is intentionally skipped —
      // the page already renders its own <h1>.
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      listItems.push(line.slice(2));
    } else if (line.trim() === '') {
      flushList();
    } else {
      flushList();
      blocks.push(
        <p key={key++} className="text-muted-foreground">
          {inline(line)}
        </p>,
      );
    }
  }
  flushList();

  return <div className="flex flex-col gap-4">{blocks}</div>;
}

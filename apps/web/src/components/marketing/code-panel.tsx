import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { CopyButton } from './copy-button';

interface CodePanelProps {
  /** File name or context label shown in the header row, e.g. `memory.json`. */
  label: string;
  /** The exact text the copy button writes to the clipboard. */
  copyText: string;
  /** Accessible label for the copy button, e.g. "Copy JSON". */
  copyLabel: string;
  /** The rendered code — plain text or pre-highlighted spans. */
  children: ReactNode;
  className?: string;
}

/**
 * A labeled, copyable block of literal file content (a directory tree, JSON,
 * Markdown source). The label names the file; it is not a fake window title
 * bar (design-system.md §8, §12). Long lines scroll horizontally instead of
 * wrapping, so the content stays copy-paste accurate; the scroll region is
 * focusable so keyboard users can scroll it too.
 */
export function CodePanel({ label, copyText, copyLabel, children, className }: CodePanelProps) {
  return (
    <figure
      className={cn(
        'min-w-0 overflow-hidden rounded-md border border-border bg-code-background',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4 border-b border-border py-1 pl-4 pr-1.5">
        <figcaption className="truncate font-mono text-sm text-muted-foreground">
          {label}
        </figcaption>
        <CopyButton value={copyText} label={copyLabel} />
      </div>
      <pre
        tabIndex={0}
        className="overflow-x-auto p-4 font-mono text-sm leading-relaxed text-foreground"
      >
        <code>{children}</code>
      </pre>
    </figure>
  );
}

import type { ReactNode } from 'react';

/**
 * A short code reference inside prose (a flag, a file path): monospace at
 * the surrounding text's size on a subtle fill, no border
 * (design-system.md §8).
 */
export function InlineCode({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground [overflow-wrap:anywhere]">
      {children}
    </code>
  );
}

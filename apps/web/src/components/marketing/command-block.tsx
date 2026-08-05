'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

/** A single copyable shell command, rendered in the monospace code style. */
export function CommandBlock({ command, className }: { command: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied by the browser; the command text is
      // still fully visible and selectable, so this is a silent no-op.
    }
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-md border border-border bg-code-background px-4 py-3',
        className,
      )}
    >
      <code className="overflow-x-auto font-mono text-sm text-foreground">
        <span aria-hidden className="select-none text-muted-foreground">
          ${' '}
        </span>
        {command}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? 'Copied' : 'Copy command'}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

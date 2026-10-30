'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

/** How long the checkmark confirmation stays visible (design-system.md §8, §10). */
const CONFIRMATION_MS = 1500;

interface CopyButtonProps {
  /** The exact text written to the clipboard. */
  value: string;
  /** Accessible label describing the action, e.g. "Copy command". */
  label: string;
  className?: string;
}

/**
 * Icon-only copy-to-clipboard control used by every code block. The visible
 * glyph is small; the pseudo-element extends the tap target to ~44px
 * (design-system.md §13).
 */
export function CopyButton({ value, label, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard access can be denied by the browser. The text stays fully
      // visible and selectable, so there is nothing to recover; no
      // confirmation is shown because nothing was copied.
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), CONFIRMATION_MS);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? 'Copied' : label}
        className={cn(
          'relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors before:absolute before:-inset-1.5 hover:bg-muted hover:text-foreground',
          className,
        )}
      >
        {copied ? (
          <Check aria-hidden className="h-3.5 w-3.5 text-success" />
        ) : (
          <Copy aria-hidden className="h-3.5 w-3.5" />
        )}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </>
  );
}

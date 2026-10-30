import { cn } from '@/lib/utils';
import { CopyButton } from './copy-button';

interface CommandTranscriptProps {
  command: string;
  /** The command's literal output, one entry per line. */
  output: readonly string[];
  className?: string;
}

/**
 * A command and the exact output it prints, in one static block. No window
 * chrome, no typing animation (design-system.md §8, §10): the `$` marks the
 * typed input, muted text marks what the command printed. Only the command
 * is copied.
 */
export function CommandTranscript({ command, output, className }: CommandTranscriptProps) {
  return (
    <div className={cn('rounded-md border border-border bg-code-background', className)}>
      <div className="flex items-center justify-between gap-4 py-1.5 pl-4 pr-1.5">
        <code className="min-w-0 overflow-x-auto whitespace-nowrap py-1 font-mono text-sm text-foreground">
          <span aria-hidden className="select-none text-muted-foreground">
            ${' '}
          </span>
          {command}
        </code>
        <CopyButton value={command} label="Copy command" />
      </div>
      <p className="sr-only">Output:</p>
      <pre className="px-4 pb-4 font-mono text-sm leading-relaxed text-muted-foreground">
        <samp>{output.join('\n')}</samp>
      </pre>
    </div>
  );
}

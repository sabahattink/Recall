import { cn } from '@/lib/utils';
import { CopyButton } from './copy-button';

interface CommandBlockProps {
  command: string;
  className?: string;
}

/** A single copyable shell command, rendered in the monospace code style. */
export function CommandBlock({ command, className }: CommandBlockProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-md border border-border bg-code-background py-1.5 pl-4 pr-1.5',
        className,
      )}
    >
      <code className="min-w-0 overflow-x-auto whitespace-nowrap py-1 font-mono text-sm text-foreground">
        <span aria-hidden className="select-none text-muted-foreground">
          ${' '}
        </span>
        {command}
      </code>
      <CopyButton value={command} label="Copy command" />
    </div>
  );
}

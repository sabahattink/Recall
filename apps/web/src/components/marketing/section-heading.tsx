import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionHeadingProps {
  /** Referenced by the parent section's `aria-labelledby`. */
  id: string;
  title: ReactNode;
  /** Optional one-paragraph introduction, held to the reading measure. */
  children?: ReactNode;
  className?: string;
}

/** The H2 + introduction pair every marketing section opens with. */
export function SectionHeading({ id, title, children, className }: SectionHeadingProps) {
  return (
    <div className={cn('max-w-2xl', className)}>
      <h2
        id={id}
        className="text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl"
      >
        {title}
      </h2>
      {children ? <p className="mt-4 leading-relaxed text-muted-foreground">{children}</p> : null}
    </div>
  );
}

import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';
import { Container } from './container';

interface SectionProps extends ComponentPropsWithoutRef<'section'> {
  containerClassName?: string;
}

/** Vertically-rhythmic page section with a bordered top edge, wrapping its children in a `Container`. */
export function Section({ className, containerClassName, children, ...props }: SectionProps) {
  return (
    <section className={cn('border-t border-border py-16 sm:py-20', className)} {...props}>
      <Container className={containerClassName}>{children}</Container>
    </section>
  );
}

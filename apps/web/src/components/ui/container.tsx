import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

/** Centered, max-width content wrapper with consistent horizontal padding. */
export function Container({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('mx-auto w-full max-w-6xl px-6', className)} {...props} />;
}

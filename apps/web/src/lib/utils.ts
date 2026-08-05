import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merges class lists and resolves conflicting Tailwind utility classes deterministically. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

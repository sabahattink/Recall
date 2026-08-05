'use client';

import type { ComponentProps } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

/**
 * Wraps `next-themes`. Default theme is "dark" (this product's intended
 * visual default), but `enableSystem` still lets a visitor opt into
 * following their OS preference, and any explicit choice they make is
 * persisted and respected on return visits.
 */
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}

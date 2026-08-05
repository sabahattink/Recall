import type { ReactNode } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { JsonLd } from '@/components/layout/json-ld';
import { siteMetadata } from '@/lib/metadata';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata = siteMetadata;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <JsonLd />
        <ThemeProvider>
          {/* Fumadocs UI's context (search dialog, i18n) for /docs routes.
              Theme is deliberately disabled here — the ThemeProvider above
              (next-themes) is the single source of theme state for the
              whole site, not just /docs. */}
          <RootProvider theme={{ enabled: false }}>
            <div className="flex min-h-screen flex-col">
              <SiteHeader />
              <main className="flex-1">{children}</main>
              <SiteFooter />
            </div>
          </RootProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

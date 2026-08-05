import Link from 'next/link';
import { siteConfig } from '@/config/site';
import { mainNav } from '@/config/navigation';
import { Container } from '@/components/ui/container';
import { ThemeToggle } from './theme-toggle';
import { MobileNavigation } from './mobile-navigation';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <Container className="relative flex h-16 items-center justify-between">
        <Link href="/" className="text-sm font-semibold tracking-tight text-foreground">
          {siteConfig.name}
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-6 sm:flex">
          {mainNav.map((item) =>
            item.external ? (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <MobileNavigation items={mainNav} />
        </div>
      </Container>
    </header>
  );
}

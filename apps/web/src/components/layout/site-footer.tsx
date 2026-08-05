import Link from 'next/link';
import { siteConfig } from '@/config/site';
import { footerNav } from '@/config/navigation';
import { Container } from '@/components/ui/container';

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <Container className="flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} {siteConfig.author.name}. Recall is open source under
          the MIT license.
        </p>

        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          {footerNav.map((item) =>
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
      </Container>
    </footer>
  );
}

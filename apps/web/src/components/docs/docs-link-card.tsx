import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export interface DocsLinkCardProps {
  title: string;
  description: string;
  href: string;
}

export function DocsLinkCard({ title, description, href }: DocsLinkCardProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col justify-between rounded-lg border border-border bg-card p-5 transition-colors hover:border-foreground/30"
    >
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-foreground">
        Read more
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

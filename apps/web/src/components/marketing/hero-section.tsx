import Link from 'next/link';
import { siteConfig } from '@/config/site';
import { Container } from '@/components/ui/container';
import { buttonVariants } from '@/components/ui/button';
import { CommandBlock } from './command-block';

export function HeroSection() {
  return (
    <section className="py-20 sm:py-28">
      <Container className="flex flex-col items-start gap-6">
        <p className="text-sm font-medium text-accent">
          Open-source context infrastructure for AI coding agents
        </p>

        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Stop explaining your codebase to AI every new session.
        </h1>

        <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Recall scans your repository and generates persistent, evidence-backed context that coding
          agents can reuse across sessions.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link href="/docs/getting-started" className={buttonVariants({ variant: 'primary' })}>
            Get started
          </Link>
          <a
            href={siteConfig.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center justify-center rounded-md border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            View on GitHub
          </a>
        </div>

        <CommandBlock command="npx recall-context init" className="mt-4 w-full max-w-md" />
      </Container>
    </section>
  );
}

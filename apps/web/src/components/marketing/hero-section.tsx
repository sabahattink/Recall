import Link from 'next/link';
import { siteConfig } from '@/config/site';
import { initOutputLines } from '@/config/product';
import { Container } from '@/components/ui/container';
import { buttonVariants } from '@/components/ui/button';
import { InlineCode } from '@/components/ui/inline-code';
import { CommandTranscript } from './command-transcript';

/**
 * Left-aligned opening statement (design-system.md §11): eyebrow, headline,
 * description, CTA row, then the command — with the exact output it prints
 * (docs/product-specification.md §11) as the proof under the claim.
 */
export function HeroSection() {
  return (
    <section aria-labelledby="hero-heading" className="py-20 sm:py-28">
      <Container>
        <div className="flex flex-col items-start">
          <p className="text-sm font-medium text-muted-foreground">
            Repository memory for AI coding assistants
          </p>

          <h1
            id="hero-heading"
            className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl lg:text-6xl"
          >
            Never explain your repository to an AI assistant again.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            One command reads your repository and writes <InlineCode>.recall/</InlineCode>: an
            evidence-backed project memory, plus a file Claude Code, Codex, Cursor, Gemini CLI, and
            ChatGPT can each read as-is.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link href="/docs/getting-started" className={buttonVariants({ variant: 'primary' })}>
              Get started
            </Link>
            <a
              href={siteConfig.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: 'secondary' })}
            >
              View on GitHub
            </a>
          </div>

          <CommandTranscript
            command={siteConfig.initCommand}
            output={initOutputLines}
            className="mt-10 w-full sm:max-w-md"
          />

          <p className="mt-4 text-sm text-muted-foreground">
            Node.js 22 or newer. No account, no API key. Recall itself never uses the network.
          </p>
        </div>
      </Container>
    </section>
  );
}

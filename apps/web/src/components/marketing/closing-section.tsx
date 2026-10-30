import Link from 'next/link';
import { siteConfig } from '@/config/site';
import { Section } from '@/components/ui/section';
import { buttonVariants } from '@/components/ui/button';
import { CommandBlock } from './command-block';
import { SectionHeading } from './section-heading';

/** Closing call to action: the product promise (spec §23) and the one command. */
export function ClosingSection() {
  return (
    <Section aria-labelledby="closing-heading">
      <SectionHeading
        id="closing-heading"
        title="A repository, once initialized, never has to explain itself again."
      >
        Run it at the root of any repository. It takes one command and leaves one directory.
      </SectionHeading>

      <CommandBlock command={siteConfig.initCommand} className="mt-8 w-full sm:max-w-md" />

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link href="/docs" className={buttonVariants({ variant: 'primary' })}>
          Read the docs
        </Link>
        <a
          href={siteConfig.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: 'secondary' })}
        >
          View source on GitHub
        </a>
      </div>

      <p className="mt-6 text-sm text-muted-foreground">Open source, MIT licensed.</p>
    </Section>
  );
}

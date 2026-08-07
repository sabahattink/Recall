import { siteConfig } from '@/config/site';
import { Section } from '@/components/ui/section';
import { HeroSection } from '@/components/marketing/hero-section';
import { ProblemSection } from '@/components/marketing/problem-section';
import { HowRecallWorksSection } from '@/components/marketing/how-recall-works-section';
import { CommandBlock } from '@/components/marketing/command-block';

const problemRows = [
  {
    label: 'Authored by',
    before: 'A human, by hand',
    after: 'Derived from repository evidence',
  },
  {
    label: 'Stays current?',
    before: 'Can go stale silently',
    after: 'Detects and reports staleness (`recall status`)',
  },
  {
    label: 'Shape',
    before: 'Typically one static document',
    after: 'Snapshot + multiple focused files',
  },
  {
    label: 'Scans the repo?',
    before: 'No',
    after: 'Yes — deterministic, local scan',
  },
  {
    label: 'Evidence paths',
    before: 'Not by default',
    after: 'Every claim traces back to source',
  },
];

const features = [
  {
    title: 'Deterministic, local-first',
    description:
      'Every run is a local, deterministic scan. No account, sign-up, or API key required.',
  },
  {
    title: 'Evidence-backed',
    description: 'Findings carry file paths as evidence — nothing is asserted without a source.',
  },
  {
    title: 'Explainable ranking',
    description:
      'Task-focused context ranking exposes its reasons in JSON, not just a black-box score.',
  },
  {
    title: 'Staleness detection',
    description: '`recall status` and `recall doctor` report when memory has drifted from code.',
  },
  {
    title: 'Human content preserved',
    description:
      'Generated Markdown wraps Recall’s content in markers; anything you write outside them survives every update.',
  },
  {
    title: 'No telemetry',
    description: 'Recall does not call home. Everything runs on your machine, in your repository.',
  },
];

const agents = [
  'Claude Code',
  'Codex',
  'Gemini CLI',
  'Cursor',
  'Any agent that can read Markdown or JSON',
];

export default function MarketingPage() {
  return (
    <>
      <HeroSection />

      <ProblemSection />

      <HowRecallWorksSection />

      <Section aria-labelledby="problem-heading">
        <h2 id="problem-heading" className="text-2xl font-semibold tracking-tight text-foreground">
          CLAUDE.md and AGENTS.md vs. Recall
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Recall doesn&apos;t replace hand-authored instruction files — it complements them with
          generated, evidence-backed context.
        </p>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-3 pr-4 font-medium text-muted-foreground"></th>
                <th className="py-3 pr-4 font-medium text-muted-foreground">
                  CLAUDE.md / AGENTS.md
                </th>
                <th className="py-3 font-medium text-foreground">Recall</th>
              </tr>
            </thead>
            <tbody>
              {problemRows.map((row) => (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <th
                    scope="row"
                    className="py-3 pr-4 font-medium text-foreground align-top whitespace-nowrap"
                  >
                    {row.label}
                  </th>
                  <td className="py-3 pr-4 align-top text-muted-foreground">{row.before}</td>
                  <td className="py-3 align-top text-foreground">{row.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section aria-labelledby="features-heading">
        <h2 id="features-heading" className="text-2xl font-semibold tracking-tight text-foreground">
          What Recall generates
        </h2>
        <dl className="mt-8 divide-y divide-border">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="grid gap-x-8 gap-y-2 py-6 sm:grid-cols-[220px_1fr] sm:py-8"
            >
              <dt className="text-sm font-semibold text-foreground">{feature.title}</dt>
              <dd className="text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section aria-labelledby="terminal-heading">
        <h2 id="terminal-heading" className="text-2xl font-semibold tracking-tight text-foreground">
          Try it in your own repository
        </h2>
        <div className="mt-8 flex flex-col gap-3 max-w-xl">
          <CommandBlock command="npx recall-context init" />
          <CommandBlock command='recall context --task "Fix password reset controller" --stdout' />
        </div>
      </Section>

      <Section aria-labelledby="agents-heading">
        <h2 id="agents-heading" className="text-2xl font-semibold tracking-tight text-foreground">
          Works with any agent that reads text
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Recall&apos;s output is plain Markdown and JSON, so it works with any coding agent that
          can read a file or stdin — including:
        </p>
        <ul className="mt-6 flex flex-wrap gap-3">
          {agents.map((agent) => (
            <li
              key={agent}
              className="rounded-full border border-border px-4 py-1.5 text-sm text-foreground"
            >
              {agent}
            </li>
          ))}
        </ul>
      </Section>

      <Section aria-labelledby="oss-heading">
        <div className="flex flex-col items-start gap-4">
          <h2 id="oss-heading" className="text-2xl font-semibold tracking-tight text-foreground">
            Open source, MIT licensed
          </h2>
          <p className="max-w-2xl text-muted-foreground">
            {siteConfig.name} is developed in the open. Read the source, file an issue, or
            contribute on GitHub.
          </p>
          <a
            href={siteConfig.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center justify-center rounded-md border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            View source on GitHub
          </a>
        </div>
      </Section>
    </>
  );
}

import { Check } from 'lucide-react';

const generatedSections = ['Architecture', 'Conventions', 'Decisions', 'Risks', 'Technical debt'];

/**
 * A static, factual representation of real `recall context` output. Per
 * docs/design-system.md §8: no fake terminal window chrome, no typing
 * animation, no blinking cursor — a plain bordered code-background block,
 * matching what running the command actually prints.
 */
export function HeroTerminal() {
  return (
    <div
      className="w-full rounded-md border border-border bg-code-background p-6 font-mono text-sm"
      role="img"
      aria-label="Terminal output: recall context reports Architecture, Conventions, Decisions, Risks, and Technical debt generated successfully."
    >
      <p aria-hidden className="text-foreground">
        <span className="select-none text-muted-foreground">$ </span>
        recall context
      </p>

      <ul aria-hidden className="mt-5 flex flex-col gap-2">
        {generatedSections.map((section) => (
          <li key={section} className="flex items-center gap-2 text-foreground">
            <Check className="h-3.5 w-3.5 shrink-0 text-success" />
            {section}
          </li>
        ))}
      </ul>

      <p aria-hidden className="mt-5 text-muted-foreground">
        Generated successfully
      </p>
    </div>
  );
}

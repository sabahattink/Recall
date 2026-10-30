import type { ProjectMemory } from '@recall-ai/schemas';

/**
 * An Agent Template (docs/product-specification.md §17): a read-only
 * transformation from Project Memory into the file format one AI assistant
 * reads best.
 *
 * `render` MUST be pure — its only input is the ProjectMemory it is given.
 * No filesystem, Git, network, clock, or environment access, and no
 * knowledge that memory does not already contain. Templates format; they
 * never investigate.
 */
export interface AgentTemplate {
  /** Stable identifier and output file base name: `claude` → `agents/claude.md`. */
  readonly id: string;
  /** The assistant this file is for, e.g. "Claude Code". */
  readonly displayName: string;
  render(memory: ProjectMemory): string;
}

/** One rendered file, addressed relative to `.recall/`. */
export interface RenderedAgentFile {
  path: string;
  contents: string;
}

export interface TemplateRegistry {
  readonly templates: readonly AgentTemplate[];
  /** Renders every registered template, in registration order. */
  render(memory: ProjectMemory): RenderedAgentFile[];
}

/** Directory inside `.recall/` that holds every agent file (spec §12). */
export const AGENTS_DIRECTORY = 'agents';

const TEMPLATE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The `.recall/`-relative path a template's output is written to. */
export function agentFilePath(template: AgentTemplate): string {
  return `${AGENTS_DIRECTORY}/${template.id}.md`;
}

/**
 * The one way templates are registered (TPL-01). Adding support for a new
 * assistant is one new `AgentTemplate` plus its entry in the list passed
 * here — nothing in the Scanner or Project Memory changes (spec §17).
 *
 * Validates every id up front, so a misconfigured registry fails when it is
 * defined rather than when output is half-written.
 */
export function defineTemplateRegistry(templates: readonly AgentTemplate[]): TemplateRegistry {
  const ids = new Set<string>();
  for (const template of templates) {
    if (!TEMPLATE_ID_PATTERN.test(template.id)) {
      throw new Error(`Invalid agent template id "${template.id}": use lowercase kebab-case`);
    }
    if (ids.has(template.id)) {
      throw new Error(`Agent template id "${template.id}" is registered more than once`);
    }
    ids.add(template.id);
  }

  const registered = Object.freeze([...templates]);
  return {
    templates: registered,
    render: (memory) =>
      registered.map((template) => ({
        path: agentFilePath(template),
        contents: template.render(memory),
      })),
  };
}

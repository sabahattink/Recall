import { describe, expect, it } from 'vitest';
import { DEFAULT_TEMPLATE_REGISTRY } from '../registry.js';
import { defineTemplateRegistry, type AgentTemplate } from '../template.js';
import { RICH_MEMORY } from './fixtures.js';

describe('DEFAULT_TEMPLATE_REGISTRY', () => {
  it('renders exactly the five agent files of the output contract, in order', () => {
    expect(DEFAULT_TEMPLATE_REGISTRY.render(RICH_MEMORY).map((file) => file.path)).toEqual([
      'agents/claude.md',
      'agents/codex.md',
      'agents/cursor.md',
      'agents/gemini.md',
      'agents/openai.md',
    ]);
  });

  it('cannot be mutated after definition', () => {
    expect(Object.isFrozen(DEFAULT_TEMPLATE_REGISTRY.templates)).toBe(true);
  });
});

describe('defineTemplateRegistry', () => {
  it('supports a new assistant with one template and one registration, nothing else (TPL-08)', () => {
    // Everything a new assistant needs: this object, and its entry below.
    // No schema, scanner, memory, or core change is involved.
    const throwaway: AgentTemplate = {
      id: 'throwaway-agent',
      displayName: 'Throwaway Agent',
      render: (memory) => `# ${memory.metadata.name?.value ?? 'unknown'}\n`,
    };

    const registry = defineTemplateRegistry([...DEFAULT_TEMPLATE_REGISTRY.templates, throwaway]);
    const files = registry.render(RICH_MEMORY);

    expect(files).toHaveLength(6);
    expect(files.at(-1)).toEqual({
      path: 'agents/throwaway-agent.md',
      contents: '# acme-platform\n',
    });
  });

  it('rejects a duplicate id', () => {
    const [first] = DEFAULT_TEMPLATE_REGISTRY.templates;
    if (!first) throw new Error('expected at least one default template');
    expect(() => defineTemplateRegistry([first, first])).toThrow(/more than once/);
  });

  it.each(['Claude', '../escape', 'with space', '', 'trailing-'])(
    'rejects the invalid id %j',
    (id) => {
      const template: AgentTemplate = { id, displayName: 'x', render: () => 'x\n' };
      expect(() => defineTemplateRegistry([template])).toThrow(/Invalid agent template id/);
    },
  );
});

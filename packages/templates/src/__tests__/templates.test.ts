import { describe, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProjectMemory } from '@recall-ai/schemas';
import { DEFAULT_TEMPLATE_REGISTRY } from '../registry.js';
import { EMPTY_MEMORY, RICH_MEMORY } from './fixtures.js';

const here = dirname(fileURLToPath(import.meta.url));
const TEMPLATES = DEFAULT_TEMPLATE_REGISTRY.templates;

/** Every string value anywhere in a memory document. */
function memoryStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(memoryStrings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(memoryStrings);
  return [];
}

/** Inline code spans, with their fences and CommonMark padding removed. */
function codeSpans(markdown: string): string[] {
  return [...markdown.matchAll(/(`+)(.+?)\1/g)].map((match) => {
    const content = match[2] ?? '';
    return content.startsWith(' ') && content.endsWith(' ') ? content.slice(1, -1) : content;
  });
}

/** Spans that are part of each template's fixed wording, not repository knowledge. */
const BOILERPLATE_SPANS = new Set([
  '.recall/memory.json',
  'memory.json',
  'npx recall-context init --force',
  'CLAUDE.md',
  'GEMINI.md',
  'AGENTS.md',
  '@.recall/agents/claude.md',
  '@.recall/agents/gemini.md',
  '.recall/agents/codex.md',
  '.cursor/rules/recall.mdc',
]);

/**
 * True when a code span is traceable to the memory it was rendered from:
 * a value (or prefix of a value, for the short commit) memory contains, a
 * `<runner> run <script>` / `name@version` / `dir/` composition of memory
 * values, an install command for a detected package manager, or fixed
 * template wording.
 */
function isTraceable(span: string, memory: ProjectMemory): boolean {
  const values = memoryStrings(memory);
  if (BOILERPLATE_SPANS.has(span)) return true;
  if (values.some((value) => value === span || value.replace(/\s+/g, ' ') === span)) return true;
  if (values.some((value) => value.startsWith(span) && span.length >= 7)) return true;
  if (memory.dependencies.some((d) => `${d.name}@${d.version}` === span)) return true;
  if (memory.structure.directories.some((d) => `${d.path}/` === span)) return true;
  const managers = memory.stack.packageManagers.map((pm) => pm.name);
  const run = /^(\S+) run (.+)$/.exec(span);
  if (run && managers.includes(run[1] ?? '') && memory.commands.some((c) => c.name === run[2])) {
    return true;
  }
  return managers.some((pm) => span.startsWith(`${pm} `) && span.endsWith('install'));
}

describe.each(TEMPLATES.map((template) => [template.id, template] as const))(
  'agent template "%s"',
  (id, template) => {
    it('matches its committed golden output (TPL-07)', async () => {
      await expect(template.render(RICH_MEMORY)).toMatchFileSnapshot(`./__golden__/${id}.md`);
    });

    it('is non-empty, LF-only, and ends with exactly one newline, even for empty memory', () => {
      for (const memory of [RICH_MEMORY, EMPTY_MEMORY]) {
        const output = template.render(memory);
        expect(output.trim().length).toBeGreaterThan(0);
        expect(output).not.toContain('\r');
        expect(output.endsWith('\n')).toBe(true);
        expect(output.endsWith('\n\n')).toBe(false);
      }
    });

    it('renders no repository section for a memory with no claims', () => {
      const output = template.render(EMPTY_MEMORY);
      expect(output.match(/^## /gm) ?? []).toEqual([]);
      expect(output).toContain('This repository');
    });

    it('contains no code span that is not traceable to memory.json', () => {
      const untraceable = codeSpans(template.render(RICH_MEMORY)).filter(
        (span) => !isTraceable(span, RICH_MEMORY),
      );
      expect(untraceable).toEqual([]);
    });

    it('renders identically every time (pure and deterministic)', () => {
      const outputs = Array.from({ length: 10 }, () => template.render(RICH_MEMORY));
      expect(new Set(outputs).size).toBe(1);
    });

    it('does not let repository text break the document structure', () => {
      const hostile: ProjectMemory = {
        ...RICH_MEMORY,
        metadata: {
          ...RICH_MEMORY.metadata,
          name: {
            value: 'evil\n# Injected heading',
            evidence: [{ path: 'package.json', reason: 'x' }],
          },
          description: {
            value: 'line one\n\n## Fake section\n- [link](http://x)',
            evidence: [{ path: 'package.json', reason: 'x' }],
          },
        },
      };
      const output = template.render(hostile);
      expect(output).not.toMatch(/^# Injected heading/m);
      expect(output).not.toMatch(/^## Fake section/m);
    });

    it.each(['- not a list', '+ not a list', '1. not a list', '2) not a list', '==='])(
      'keeps a description starting with %j as plain text, not a block construct',
      (description) => {
        const memory: ProjectMemory = {
          ...EMPTY_MEMORY,
          metadata: {
            ...EMPTY_MEMORY.metadata,
            description: { value: description, evidence: [{ path: 'package.json', reason: 'x' }] },
          },
        };
        const output = template.render(memory);
        expect(output).toContain('\\');
        expect(output.split('\n')).not.toContain(description);
      },
    );
  },
);

describe('template purity', () => {
  it('no template source imports Node built-ins or reads process state', async () => {
    const sourceDir = join(here, '..');
    const files = [
      ...(await readdir(sourceDir)).filter((f) => f.endsWith('.ts')).map((f) => join(sourceDir, f)),
      ...(await readdir(join(sourceDir, 'agents'))).map((f) => join(sourceDir, 'agents', f)),
    ];
    for (const file of files) {
      const source = await readFile(file, 'utf8');
      expect(source, file).not.toMatch(/from ['"](node:|fs|path|child_process|os|http|https|net)/);
      expect(source, file).not.toMatch(/\bprocess\.|\bDate\b|Math\.random|\bfetch\(/);
    }
  });
});

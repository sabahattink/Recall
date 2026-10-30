import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { initOutputLines, memoryTopLevelKeys, outputTree } from '../config/product';

/** The canonical spec, read from the monorepo root (vitest runs with apps/web as cwd). */
const specification = readFileSync(
  join(process.cwd(), '..', '..', 'docs', 'product-specification.md'),
  'utf8',
).replace(/\r\n/g, '\n');

/** The body of the first fenced code block after `## <heading>`. */
function firstCodeBlockUnder(heading: string): string {
  const start = specification.indexOf(`\n## ${heading}\n`);
  if (start === -1) throw new Error(`Section "${heading}" not found in the specification`);
  const match = /\n```[^\n]*\n([\s\S]*?)\n```/.exec(specification.slice(start));
  if (!match?.[1]) throw new Error(`No code block found under "${heading}"`);
  return match[1];
}

/** All fenced code blocks under `## <heading>`, up to the next `## ` heading. */
function codeBlocksUnder(heading: string): string[] {
  const start = specification.indexOf(`\n## ${heading}\n`);
  if (start === -1) throw new Error(`Section "${heading}" not found in the specification`);
  const rest = specification.slice(start + heading.length + 5);
  const end = rest.search(/\n## /);
  const section = end === -1 ? rest : rest.slice(0, end);
  return [...section.matchAll(/```[^\n]*\n([\s\S]*?)\n```/g)].map((m) => m[1] ?? '');
}

describe('product facts shown on the site', () => {
  it('prints exactly the stdout defined in spec §11', () => {
    const blocks = codeBlocksUnder('11. The First User Experience');
    expect(blocks).toContain(initOutputLines.join('\n'));
  });

  it('shows exactly the output tree defined in spec §12', () => {
    expect(outputTree).toBe(firstCodeBlockUnder('12. Output Contract'));
  });

  it('lists the memory.json top-level keys: schemaVersion first, then the eight categories of spec §16', () => {
    expect(memoryTopLevelKeys[0]).toBe('schemaVersion');
    expect(memoryTopLevelKeys.slice(1)).toEqual([
      'metadata',
      'stack',
      'architecture',
      'structure',
      'commands',
      'conventions',
      'dependencies',
      'risks',
    ]);
  });
});

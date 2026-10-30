import { describe, expect, it } from 'vitest';
import { ProjectMemorySchema, type FactCollection } from '@recall-ai/schemas';
import { normalizeFacts } from '../normalize.js';
import { serializeProjectMemory } from '../serialize.js';

const FACTS: FactCollection = [
  {
    category: 'repository-metadata',
    value: { key: 'name', value: 'acme' },
    evidence: [{ path: 'package.json', reason: 'name declared in package.json' }],
  },
  {
    category: 'language',
    value: 'TypeScript',
    evidence: [{ path: 'tsconfig.json', reason: 'tsconfig.json present' }],
  },
  {
    category: 'directory',
    value: { path: 'src', role: 'source' },
    evidence: [{ path: 'src/index.ts', reason: 'matches the source file pattern' }],
  },
  {
    category: 'command',
    value: { name: 'test', command: 'vitest run' },
    evidence: [{ path: 'package.json', reason: 'scripts.test declared as "vitest run"' }],
  },
  {
    category: 'dependency',
    value: { name: 'zod', version: '^3.24.1', scope: 'dependency' },
    evidence: [{ path: 'package.json', reason: 'dependencies.zod declared' }],
  },
];

describe('serializeProjectMemory', () => {
  it('writes LF-only, two-space-indented JSON with a trailing newline', () => {
    const text = serializeProjectMemory(normalizeFacts(FACTS));
    expect(text.endsWith('}\n')).toBe(true);
    expect(text).not.toContain('\r');
    expect(text.split('\n')[1]).toBe('  "schemaVersion": "1.0.0",');
  });

  it('round-trips through the schema', () => {
    const text = serializeProjectMemory(normalizeFacts(FACTS));
    expect(ProjectMemorySchema.safeParse(JSON.parse(text)).success).toBe(true);
  });

  it('emits keys in schema order even when the input object was built in another order', () => {
    const memory = normalizeFacts(FACTS);
    const shuffled = JSON.parse(
      JSON.stringify(memory, (_key, value: unknown) =>
        value && typeof value === 'object' && !Array.isArray(value)
          ? Object.fromEntries(Object.entries(value).reverse())
          : value,
      ),
    );
    expect(serializeProjectMemory(shuffled)).toBe(serializeProjectMemory(memory));
  });

  it('is byte-identical across ten consecutive normalize + serialize runs (MEM-06)', () => {
    const outputs = Array.from({ length: 10 }, () => serializeProjectMemory(normalizeFacts(FACTS)));
    expect(new Set(outputs).size).toBe(1);
  });
});

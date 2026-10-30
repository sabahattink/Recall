import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  PROJECT_MEMORY_CATEGORIES,
  PROJECT_MEMORY_SCHEMA_VERSION,
  ProjectMemorySchema,
  type ProjectMemory,
} from '../project-memory.js';

const AGENT_NAMES = ['claude', 'codex', 'cursor', 'gemini', 'openai'];

/** Every object key declared anywhere in a schema, unwrapping arrays/nullables/effects. */
function collectKeys(schema: z.ZodTypeAny): string[] {
  if (schema instanceof z.ZodObject) {
    return Object.entries(schema.shape as Record<string, z.ZodTypeAny>).flatMap(([key, child]) => [
      key,
      ...collectKeys(child),
    ]);
  }
  if (schema instanceof z.ZodArray) return collectKeys(schema.element as z.ZodTypeAny);
  if (schema instanceof z.ZodNullable || schema instanceof z.ZodOptional) {
    return collectKeys(schema.unwrap() as z.ZodTypeAny);
  }
  return [];
}

function emptyMemory(): ProjectMemory {
  return {
    schemaVersion: PROJECT_MEMORY_SCHEMA_VERSION,
    metadata: { name: null, description: null, commit: null, defaultBranch: null, remoteUrl: null },
    stack: { languages: [], frameworks: [], packageManagers: [] },
    architecture: { layout: null, entryPoints: [] },
    structure: { directories: [] },
    commands: [],
    conventions: { testing: [], linting: [] },
    dependencies: [],
    risks: [],
  };
}

describe('ProjectMemorySchema', () => {
  it('contains exactly the spec §16 knowledge categories plus the format version', () => {
    expect(Object.keys(ProjectMemorySchema.shape)).toEqual([
      'schemaVersion',
      ...PROJECT_MEMORY_CATEGORIES,
    ]);
  });

  it('has no field referring to a specific agent, at any depth', () => {
    const keys = collectKeys(ProjectMemorySchema).join(' ').toLowerCase();
    expect(keys).toContain('dependencies');
    for (const agent of AGENT_NAMES) {
      expect(keys).not.toContain(agent);
    }
  });

  it('accepts a memory with every category empty (no evidence, no claims)', () => {
    expect(ProjectMemorySchema.safeParse(emptyMemory()).success).toBe(true);
  });

  it('rejects an unknown top-level key', () => {
    const result = ProjectMemorySchema.safeParse({ ...emptyMemory(), agents: {} });
    expect(result.success).toBe(false);
  });

  it('rejects a different schema version', () => {
    const result = ProjectMemorySchema.safeParse({ ...emptyMemory(), schemaVersion: '0.9.0' });
    expect(result.success).toBe(false);
  });

  it('rejects an entry without evidence', () => {
    const memory = emptyMemory();
    const result = ProjectMemorySchema.safeParse({
      ...memory,
      stack: { ...memory.stack, languages: [{ name: 'TypeScript', evidence: [] }] },
    });
    expect(result.success).toBe(false);
  });

  it('rebuilds keys in schema order regardless of input key order', () => {
    const memory = emptyMemory();
    const reordered = Object.fromEntries(Object.entries(memory).reverse());
    const parsed = ProjectMemorySchema.parse(reordered);
    expect(Object.keys(parsed)).toEqual(Object.keys(ProjectMemorySchema.shape));
  });
});

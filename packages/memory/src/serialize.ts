import { ProjectMemorySchema, type ProjectMemory } from '@recall-ai/schemas';

const JSON_INDENT = 2;

/**
 * Serializes Project Memory to the canonical text of `memory.json` (MEM-03):
 * schema key order (parsing rebuilds every object in shape order), two-space
 * indentation, `\n` line endings on every platform, and a trailing newline.
 * The same ProjectMemory always serializes to the same bytes, and the output
 * is guaranteed to validate against `ProjectMemorySchema` because it is
 * produced from a value that just did.
 */
export function serializeProjectMemory(memory: ProjectMemory): string {
  return `${JSON.stringify(ProjectMemorySchema.parse(memory), null, JSON_INDENT)}\n`;
}

import { join } from 'node:path';
import {
  DEFAULT_RECALL_CONFIG,
  RecallConfigSchema,
  type RecallConfig,
} from '@recall-ai/schemas';
import { readFileIfExists, RECALL_DIR_NAME } from './safe-fs.js';

export const RECALL_CONFIG_FILE = 'config.json';

/**
 * Reads the optional .recall/config.json analysis-scope configuration.
 * Missing or malformed files fall back to the deterministic defaults rather
 * than making repository analysis depend on configuration parsing success.
 */
export async function readRecallConfig(root: string): Promise<RecallConfig> {
  const raw = await readFileIfExists(join(root, RECALL_DIR_NAME, RECALL_CONFIG_FILE));
  if (raw === null) return { ...DEFAULT_RECALL_CONFIG, ignore: [], include: [] };

  try {
    const parsed = RecallConfigSchema.safeParse(JSON.parse(raw));
    if (parsed.success) {
      return {
        ignore: [...parsed.data.ignore],
        include: [...parsed.data.include],
      };
    }
  } catch {
    // Fall through to defaults. Doctor can grow explicit config diagnostics
    // in a later phase without making today's scanner fail open or closed.
  }

  return { ...DEFAULT_RECALL_CONFIG, ignore: [], include: [] };
}

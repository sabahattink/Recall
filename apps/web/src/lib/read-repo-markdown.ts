import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Reads a Markdown file from the monorepo root (two levels up from
 * apps/web) — used so pages like /changelog and /roadmap render the
 * repository's actual source-of-truth files instead of a duplicated copy.
 */
export function readRepoMarkdown(...segments: string[]): Promise<string> {
  const path = join(process.cwd(), '..', '..', ...segments);
  return readFile(path, 'utf8');
}

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Reads specific Markdown files from the monorepo root (two levels up from
 * apps/web) — used so pages like /changelog and /roadmap render the
 * repository's actual source-of-truth files instead of a duplicated copy.
 *
 * Each function below resolves a single, fully literal path rather than
 * accepting caller-supplied segments: Turbopack's static file tracer can
 * only prove which files a build needs when the `path.join(...)` arguments
 * are literals it can evaluate at build time. A spread/variadic path (e.g.
 * `join(process.cwd(), '..', '..', ...segments)`) can resolve to anything,
 * so the tracer falls back to bundling the entire project as server output.
 * A literal argument list per file keeps each read scoped to exactly the
 * one file it needs.
 */
export function readChangelogMarkdown(): Promise<string> {
  return readFile(join(process.cwd(), '..', '..', 'CHANGELOG.md'), 'utf8');
}

export function readRoadmapMarkdown(): Promise<string> {
  return readFile(join(process.cwd(), '..', '..', 'docs', 'roadmap.md'), 'utf8');
}

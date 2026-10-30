import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docsDir = join(process.cwd(), 'content', 'docs');
const marketingDir = join(process.cwd(), 'src', 'components', 'marketing');
const configDir = join(process.cwd(), 'src', 'config');

function readAll(dir: string, extension: string): Array<{ file: string; text: string }> {
  return readdirSync(dir)
    .filter((file) => file.endsWith(extension))
    .map((file) => ({ file, text: readFileSync(join(dir, file), 'utf8') }));
}

const docs = readAll(docsDir, '.mdx');
const siteSources = [
  ...readAll(marketingDir, '.tsx'),
  ...readAll(configDir, '.ts'),
  {
    file: 'page.tsx',
    text: readFileSync(join(process.cwd(), 'src', 'app', '(marketing)', 'page.tsx'), 'utf8'),
  },
];

/**
 * Things v1 does not have (docs/product-specification.md §18, §19) or that
 * only existed in v0.2. None of them may be described anywhere the site
 * explains the product.
 */
const RETIRED_OR_EXCLUDED: Array<[string, RegExp]> = [
  ['a v0.2 command', /\brecall (scan|update|status|explain|context|doctor)\b/],
  ['the --task flag', /--task\b/],
  ['manifest.json', /manifest\.json/],
  ['snapshots', /snapshots?\//],
  ['decisions.md', /decisions\.md/],
  ['staleness detection', /stalen/i],
  ['generated markers', /\bmarkers?\b/i],
  ['task ranking', /\branking\b/i],
  ['MCP', /\bMCP\b/],
  ['embeddings', /embedding/i],
  ['RAG', /\bRAG\b/],
  ['vector databases', /\bvector\b/i],
  ['the unrelated `recall` npm package', /npx recall init/],
];

describe('docs content', () => {
  it('lists every docs page in meta.json, and every meta.json entry has a page', () => {
    const meta = JSON.parse(readFileSync(join(docsDir, 'meta.json'), 'utf8')) as {
      pages: string[];
    };
    const pages = docs.map((doc) => doc.file.replace(/\.mdx$/, '')).sort();
    expect([...meta.pages].sort()).toEqual(pages);
  });

  it('includes the output-format page', () => {
    expect(docs.map((doc) => doc.file)).toContain('output-format.mdx');
  });

  it.each(RETIRED_OR_EXCLUDED)('never mentions %s', (_label, pattern) => {
    for (const { file, text } of [...docs, ...siteSources]) {
      expect({ file, match: pattern.exec(text)?.[0] ?? null }).toEqual({ file, match: null });
    }
  });

  it('documents exit codes 0 through 5 on the command reference', () => {
    const commands = docs.find((doc) => doc.file === 'commands.mdx');
    if (!commands) throw new Error('commands.mdx is missing');
    for (const code of [0, 1, 2, 3, 4, 5]) {
      expect(commands.text).toMatch(new RegExp(`\\|\\s*\`${code}\`\\s*\\|`));
    }
  });
});

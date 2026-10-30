import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FactCollectionSchema, REDACTED, type Fact } from '@recall-ai/schemas';
import { createTempDir, removeTempDir, writeTree, type FileTree } from '@recall-ai/test-fixtures';
import { scanRepository } from '../scanner.js';
import { walkRepository } from '../file-walk.js';

/**
 * Regression tests for repository content that is unusual but real:
 * byte-order marks, malformed manifests, and secrets embedded in
 * manifests. Each one previously either dropped Facts silently, aborted
 * the whole scan, or copied a credential into memory.
 */
describe('scanner input hardening', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  async function scan(tree: FileTree): Promise<Fact[]> {
    await writeTree(dir, tree);
    const facts = await scanRepository(dir);
    expect(FactCollectionSchema.safeParse(facts).success).toBe(true);
    return facts;
  }

  const values = (facts: Fact[], category: Fact['category']) =>
    facts.filter((f) => f.category === category).map((f) => f.value);

  it('reads a package.json saved with a UTF-8 byte-order mark', async () => {
    const facts = await scan({
      'package.json': `\uFEFF${JSON.stringify({ name: 'bom-app', scripts: { test: 'vitest' } })}`,
    });
    expect(values(facts, 'repository-metadata')).toEqual([{ key: 'name', value: 'bom-app' }]);
    expect(values(facts, 'command')).toEqual([{ name: 'test', command: 'vitest' }]);
  });

  it('reads a TOML manifest and a .gitignore saved with a byte-order mark', async () => {
    const facts = await scan({
      'Cargo.toml': '\uFEFF[package]\nname = "bom-crate"\n',
      '.gitignore': '\uFEFF.env\n',
      '.env': 'SECRET=1',
      'src/main.rs': '',
    });
    expect(values(facts, 'repository-metadata')).toEqual([{ key: 'name', value: 'bom-crate' }]);
    expect(facts.some((f) => f.evidence.some((e) => e.path === '.env'))).toBe(false);
  });

  it('skips malformed entry points and dependency maps instead of aborting the scan', async () => {
    const facts = await scan({
      'package.json': JSON.stringify({
        name: 'broken',
        main: './',
        bin: { empty: '', dot: '.', ok: './cli.js' },
        dependencies: { '': '1.0.0', good: '^2.0.0' },
        devDependencies: ['not', 'an', 'object'],
      }),
    });
    expect(values(facts, 'architecture-hint')).toEqual([
      { path: 'cli.js', kind: 'bin', workspace: null },
    ]);
    expect(values(facts, 'dependency')).toEqual([
      { name: 'good', version: '^2.0.0', scope: 'dependency' },
    ]);
  });

  it('never copies credentials from dependency specifiers or scripts into Facts', async () => {
    const facts = await scan({
      'package.json': JSON.stringify({
        scripts: { test: 'cross-env API_KEY=sk-live-123 vitest' },
        dependencies: { lib: 'git+https://bot:ghp_secret@github.com/acme/lib.git' },
      }),
    });
    const serialized = JSON.stringify(facts);
    expect(serialized).not.toContain('sk-live-123');
    expect(serialized).not.toContain('ghp_secret');
    expect(values(facts, 'command')).toEqual([
      { name: 'test', command: `cross-env API_KEY=${REDACTED} vitest` },
    ]);
    expect(values(facts, 'dependency')).toEqual([
      { name: 'lib', version: 'git+https://github.com/acme/lib.git', scope: 'dependency' },
    ]);
  });

  it('recognizes LICENSE-MIT style license files', async () => {
    const facts = await scan({ 'LICENSE-MIT': 'MIT', 'src/index.ts': '' });
    expect(values(facts, 'risk-indicator')).not.toContainEqual(
      expect.objectContaining({ id: 'no-license' }),
    );
  });

  it('reads a quoted Go module path with a trailing comment', async () => {
    const facts = await scan({ 'go.mod': 'module "example.com/quoted" // the module\n' });
    expect(values(facts, 'repository-metadata')).toEqual([
      { key: 'name', value: 'example.com/quoted' },
    ]);
  });

  it('does not report truncation for a repository with exactly maxFiles files', async () => {
    await writeTree(dir, { 'a.ts': '', 'b.ts': '', 'c.ts': '' });
    expect((await walkRepository(dir, { maxFiles: 3 })).truncated).toBe(false);
    expect((await walkRepository(dir, { maxFiles: 2 })).truncated).toBe(true);
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FactCollectionSchema } from '@recall-ai/schemas';
import { createTempDir, removeTempDir, writeTree, type FileTree } from '@recall-ai/test-fixtures';
import { detectRepositoryMetadataFacts, readTomlString } from '../repository-metadata-facts.js';
import { walkRepository } from '../file-walk.js';

describe('detectRepositoryMetadataFacts', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  async function detect(
    tree: FileTree,
    git: Parameters<typeof detectRepositoryMetadataFacts>[2] = null,
  ) {
    await writeTree(dir, tree);
    const { files } = await walkRepository(dir);
    const facts = await detectRepositoryMetadataFacts(files, dir, git);
    expect(FactCollectionSchema.safeParse(facts).success).toBe(true);
    return facts;
  }

  it('reads name and description from package.json, citing it', async () => {
    const facts = await detect({
      'package.json': JSON.stringify({ name: 'acme', description: 'Does things.' }),
    });
    expect(facts).toEqual([
      {
        category: 'repository-metadata',
        value: { key: 'name', value: 'acme' },
        evidence: [{ path: 'package.json', reason: 'name declared in package.json' }],
      },
      {
        category: 'repository-metadata',
        value: { key: 'description', value: 'Does things.' },
        evidence: [{ path: 'package.json', reason: 'description declared in package.json' }],
      },
    ]);
  });

  it('prefers package.json, then Cargo.toml, then pyproject.toml, then go.mod', async () => {
    const facts = await detect({
      'Cargo.toml': '[package]\nname = "crate-name"\ndescription = "From Cargo."\n',
      'go.mod': 'module example.com/go-name\n',
    });
    expect(facts.map((f) => [f.value.key, f.value.value, f.evidence[0]?.path])).toEqual([
      ['name', 'crate-name', 'Cargo.toml'],
      ['description', 'From Cargo.', 'Cargo.toml'],
    ]);
  });

  it('reads a Go module path as the name', async () => {
    const facts = await detect({ 'go.mod': 'module github.com/acme/tool\n\ngo 1.22\n' });
    expect(facts.map((f) => f.value)).toEqual([{ key: 'name', value: 'github.com/acme/tool' }]);
  });

  it('never falls back to the directory name', async () => {
    expect(await detect({ 'src/index.ts': '' })).toEqual([]);
  });

  it('ignores a malformed package.json and non-string fields', async () => {
    expect(await detect({ 'package.json': '{ not json' })).toEqual([]);
    expect(await detect({ 'package.json': JSON.stringify({ name: 42, description: '' }) })).toEqual(
      [],
    );
  });

  it('turns provided git metadata into facts, skipping absent fields', async () => {
    const facts = await detect(
      {},
      { commit: 'a'.repeat(40), defaultBranch: null, remoteUrl: 'https://x/y.git' },
    );
    expect(facts.map((f) => f.value)).toEqual([
      { key: 'commit', value: 'a'.repeat(40) },
      { key: 'remote-url', value: 'https://x/y.git' },
    ]);
  });
});

describe('readTomlString', () => {
  const toml = [
    '# comment',
    'name = "top-level-is-ignored"',
    '[tool.poetry]',
    'name = "poetry-name"',
    '[project]',
    "description = 'literal string'",
    'name = "escaped \\"quote\\""  # trailing comment',
    '[[bin]]',
    'name = "array-table-is-ignored"',
  ].join('\n');

  it('reads from the first listed table that declares the key', () => {
    expect(readTomlString(toml, ['project', 'tool.poetry'], 'name')).toBe('escaped "quote"');
    expect(readTomlString(toml, ['tool.poetry', 'project'], 'name')).toBe('poetry-name');
  });

  it('reads literal strings and ignores array tables and the root table', () => {
    expect(readTomlString(toml, ['project'], 'description')).toBe('literal string');
    expect(readTomlString(toml, ['bin'], 'name')).toBeNull();
  });

  it('treats an unsupported value form as absent rather than guessing', () => {
    expect(readTomlString('[project]\nname = """multi"""\n', ['project'], 'name')).toBeNull();
  });
});

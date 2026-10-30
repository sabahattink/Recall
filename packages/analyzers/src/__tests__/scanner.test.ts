import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FactCollectionSchema, type FactCollection } from '@recall-ai/schemas';
import {
  REFERENCE_FIXTURES,
  createTempDir,
  integrationHookTimeout,
  removeTempDir,
  writeTree,
} from '@recall-ai/test-fixtures';
import { scanRepository } from '../scanner.js';

/**
 * Scanner integration suite (SCAN-11): the full Scanner against every
 * reference fixture, with the complete Fact collection compared to a
 * committed golden file. Regenerate deliberately with `vitest run -u` and
 * review the diff.
 */
describe.each(REFERENCE_FIXTURES.map((fixture) => [fixture.name, fixture] as const))(
  'scanRepository on the "%s" fixture',
  (name, fixture) => {
    let dir: string;
    let facts: FactCollection;

    beforeAll(async () => {
      dir = await createTempDir(`recall-scan-${name}-`);
      await fixture.build(dir);
      facts = await scanRepository(dir);
    }, integrationHookTimeout);

    afterAll(async () => {
      await removeTempDir(dir);
    });

    it('produces a schema-valid Fact collection matching the golden file', async () => {
      expect(FactCollectionSchema.safeParse(facts).success).toBe(true);
      await expect(`${JSON.stringify(facts, null, 2)}\n`).toMatchFileSnapshot(
        `./__golden__/${name}.facts.json`,
      );
    });

    it('cites only root-relative, forward-slash evidence paths', () => {
      for (const evidence of facts.flatMap((fact) => fact.evidence)) {
        expect(evidence.path).not.toMatch(/^\/|^[A-Za-z]:|\\/);
      }
    });

    it('is deterministic across repeated scans', async () => {
      expect(await scanRepository(dir)).toEqual(facts);
    });
  },
);

describe('scanRepository', () => {
  let dir: string;

  beforeAll(async () => {
    dir = await createTempDir();
  });

  afterAll(async () => {
    await removeTempDir(dir);
  });

  it('produces no facts for an empty directory, never an error', async () => {
    expect(await scanRepository(dir)).toEqual([]);
  });

  it('ignores its own output and staging directories', async () => {
    await writeTree(dir, {
      'package.json': JSON.stringify({ name: 'self' }),
      '.recall/agents/claude.md': '# old output',
      '.recall.staging-abc123/memory.json': '{}',
      '.recall.previous-def456/agents/notes.md': '# leftover',
    });
    const facts = await scanRepository(dir);
    const cited = facts.flatMap((fact) => fact.evidence.map((e) => e.path));
    expect(cited.some((path) => path.startsWith('.recall'))).toBe(false);
  });

  it('attaches caller-provided git metadata as repository-metadata facts', async () => {
    const facts = await scanRepository(dir, {
      git: { commit: 'b'.repeat(40), defaultBranch: 'main', remoteUrl: null },
    });
    expect(facts.filter((f) => f.category === 'repository-metadata').map((f) => f.value)).toEqual([
      { key: 'name', value: 'self' },
      { key: 'commit', value: 'b'.repeat(40) },
      { key: 'default-branch', value: 'main' },
    ]);
  });
});

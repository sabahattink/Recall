import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ProjectMemorySchema } from '@recall-ai/schemas';
import { DEFAULT_TEMPLATE_REGISTRY, defineTemplateRegistry } from '@recall-ai/templates';
import {
  buildSimpleNodeFixture,
  commitAll,
  createDirLink,
  createTempDir,
  initGitRepo,
  integrationTestTimeout,
  removeTempDir,
} from '@recall-ai/test-fixtures';
import {
  AlreadyInitializedError,
  ExitCode,
  InvalidPathError,
  UnsafeOutputLocationError,
  runInit,
  type InitStage,
} from '../index.js';
import { snapshotTree, withoutRecallDirectory } from './tree-snapshot.js';

const OUTPUT_CONTRACT = [
  '.recall/agents/claude.md',
  '.recall/agents/codex.md',
  '.recall/agents/cursor.md',
  '.recall/agents/gemini.md',
  '.recall/agents/openai.md',
  '.recall/memory.json',
];

const noGit = async () => null;

describe('runInit', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempDir();
    await buildSimpleNodeFixture(dir);
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  it(
    'writes exactly the six files of the output contract and changes nothing else',
    async () => {
      const before = await snapshotTree(dir);

      const result = await runInit({ path: dir, force: false, readGitMetadata: noGit });

      const after = await snapshotTree(dir);
      expect(Object.keys(after).filter((p) => p.startsWith('.recall/'))).toEqual(OUTPUT_CONTRACT);
      expect(withoutRecallDirectory(after)).toEqual(before);
      expect(result.files).toEqual([
        'memory.json',
        'agents/claude.md',
        'agents/codex.md',
        'agents/cursor.md',
        'agents/gemini.md',
        'agents/openai.md',
      ]);
    },
    integrationTestTimeout,
  );

  it(
    'writes a memory.json that validates against the ProjectMemory schema',
    async () => {
      await runInit({ path: dir, force: false, readGitMetadata: noGit });
      const memory = JSON.parse(await readFile(join(dir, '.recall', 'memory.json'), 'utf8'));
      expect(ProjectMemorySchema.safeParse(memory).success).toBe(true);
      expect(memory.metadata.name.value).toBe('simple-node-fixture');
    },
    integrationTestTimeout,
  );

  it(
    'reports the three pipeline stages in order',
    async () => {
      const stages: InitStage[] = [];
      await runInit({
        path: dir,
        force: false,
        readGitMetadata: noGit,
        onStage: (s) => stages.push(s),
      });
      expect(stages).toEqual(['scan', 'memory', 'generate']);
    },
    integrationTestTimeout,
  );

  it(
    'refuses a second run without --force and leaves the disk untouched (CLI-05)',
    async () => {
      await runInit({ path: dir, force: false, readGitMetadata: noGit });
      const before = await snapshotTree(dir);

      const stages: InitStage[] = [];
      const second = runInit({
        path: dir,
        force: false,
        readGitMetadata: noGit,
        onStage: (s) => stages.push(s),
      });

      await expect(second).rejects.toBeInstanceOf(AlreadyInitializedError);
      await expect(second).rejects.toMatchObject({ exitCode: ExitCode.AlreadyInitialized });
      expect(stages).toEqual([]);
      expect(await snapshotTree(dir)).toEqual(before);
    },
    integrationTestTimeout,
  );

  it(
    'with --force reproduces the first run byte for byte (idempotency)',
    async () => {
      await runInit({ path: dir, force: false, readGitMetadata: noGit });
      const first = await snapshotTree(dir);

      await runInit({ path: dir, force: true, readGitMetadata: noGit });

      expect(await snapshotTree(dir)).toEqual(first);
    },
    integrationTestTimeout,
  );

  it(
    'with --force replaces stale or hand-added files inside .recall/',
    async () => {
      await mkdir(join(dir, '.recall'));
      await writeFile(join(dir, '.recall', 'manifest.json'), '{"legacy":true}');

      await runInit({ path: dir, force: true, readGitMetadata: noGit });

      const after = await snapshotTree(dir);
      expect(Object.keys(after).filter((p) => p.startsWith('.recall/'))).toEqual(OUTPUT_CONTRACT);
    },
    integrationTestTimeout,
  );

  it(
    'writes nothing when a stage fails (no silent partial success)',
    async () => {
      const before = await snapshotTree(dir);
      const failing = defineTemplateRegistry([
        ...DEFAULT_TEMPLATE_REGISTRY.templates,
        {
          id: 'broken',
          displayName: 'Broken',
          render: () => {
            throw new Error('template exploded');
          },
        },
      ]);

      await expect(
        runInit({ path: dir, force: false, readGitMetadata: noGit, templates: failing }),
      ).rejects.toThrow('template exploded');
      expect(await snapshotTree(dir)).toEqual(before);
    },
    integrationTestTimeout,
  );

  it('rejects a missing path before doing anything', async () => {
    await expect(
      runInit({ path: join(dir, 'does-not-exist'), force: false, readGitMetadata: noGit }),
    ).rejects.toMatchObject({ exitCode: ExitCode.InvalidPath });
  });

  it('rejects a path that is a file', async () => {
    await expect(
      runInit({ path: join(dir, 'package.json'), force: false, readGitMetadata: noGit }),
    ).rejects.toBeInstanceOf(InvalidPathError);
  });

  it(
    'refuses a symlinked .recall even with --force, writing nothing through it',
    async () => {
      const outside = await createTempDir('recall-outside-');
      try {
        await createDirLink(outside, join(dir, '.recall'));
        await expect(
          runInit({ path: dir, force: true, readGitMetadata: noGit }),
        ).rejects.toBeInstanceOf(UnsafeOutputLocationError);
        expect(await snapshotTree(outside)).toEqual({});
      } finally {
        await removeTempDir(outside);
      }
    },
    integrationTestTimeout,
  );

  it(
    'records git metadata from a real repository, and a later run is unaffected by .recall/ itself',
    async () => {
      await initGitRepo(dir);
      await commitAll(dir, 'chore: initial commit');

      await runInit({ path: dir, force: false });
      const first = await snapshotTree(dir);
      const memory = JSON.parse(first['.recall/memory.json'] ?? '{}');
      expect(memory.metadata.commit.value).toMatch(/^[0-9a-f]{40}$/);

      // .recall/ is now untracked in the work tree; it must not change the result.
      await runInit({ path: dir, force: true });
      expect(await snapshotTree(dir)).toEqual(first);
    },
    integrationTestTimeout * 2,
  );
});

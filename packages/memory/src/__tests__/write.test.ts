import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { createTempDir, removeTempDir } from '@recall-ai/test-fixtures';
import { applyMemoryFileUpdates, computeMemoryFileUpdates } from '../write.js';
import { GENERATED_END, GENERATED_START } from '../markers.js';
import { makeSnapshot } from './test-helpers.js';

describe('computeMemoryFileUpdates / applyMemoryFileUpdates', () => {
  let recallDir: string;

  beforeEach(async () => {
    recallDir = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(recallDir);
  });

  it('creates all seven memory files on first run', async () => {
    const snapshot = makeSnapshot();
    const updates = await computeMemoryFileUpdates(recallDir, snapshot);
    expect(updates.map((u) => u.fileName).sort()).toEqual(
      [
        'architecture.md',
        'conventions.md',
        'decisions.md',
        'features.md',
        'glossary.md',
        'risks.md',
        'technical-debt.md',
      ].sort(),
    );
    expect(updates.every((u) => u.changed)).toBe(true);

    await applyMemoryFileUpdates(recallDir, updates);
    const architecture = await readFile(join(recallDir, 'architecture.md'), 'utf8');
    expect(architecture).toContain(GENERATED_START);
    expect(architecture).toContain(GENERATED_END);
  });

  it('preserves human-authored content outside markers across an update', async () => {
    const snapshot = makeSnapshot({
      workspaces: [
        {
          name: 'root',
          path: '.',
          kind: 'root',
          version: '1.0.0',
          private: true,
          dependsOn: [],
          main: null,
          scripts: {},
        },
      ],
    });
    const firstUpdates = await computeMemoryFileUpdates(recallDir, snapshot);
    await applyMemoryFileUpdates(recallDir, firstUpdates);

    const architecturePath = join(recallDir, 'architecture.md');
    const original = await readFile(architecturePath, 'utf8');
    const withHumanNote = original.replace(
      '## Notes',
      '## Notes\n\nThis service intentionally depends on the legacy billing package for tax calculation.',
    );
    const { atomicWriteFile } = await import('../safe-fs.js');
    await atomicWriteFile(architecturePath, withHumanNote);

    const updatedSnapshot = makeSnapshot({
      workspaces: [
        {
          name: 'root-renamed',
          path: '.',
          kind: 'root',
          version: '2.0.0',
          private: true,
          dependsOn: [],
          main: null,
          scripts: {},
        },
      ],
    });
    const secondUpdates = await computeMemoryFileUpdates(recallDir, updatedSnapshot);
    await applyMemoryFileUpdates(recallDir, secondUpdates);

    const final = await readFile(architecturePath, 'utf8');
    expect(final).toContain(
      'This service intentionally depends on the legacy billing package for tax calculation.',
    );
  });

  it('does not rewrite a file when the generated content has not changed', async () => {
    const snapshot = makeSnapshot();
    const firstUpdates = await computeMemoryFileUpdates(recallDir, snapshot);
    await applyMemoryFileUpdates(recallDir, firstUpdates);

    const secondUpdates = await computeMemoryFileUpdates(recallDir, snapshot);
    expect(secondUpdates.every((u) => !u.changed)).toBe(true);
  });
});

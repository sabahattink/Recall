import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createTempDir,
  removeTempDir,
  writeTree,
} from '@recall-ai/test-fixtures';
import type { EntryPoint, FileRecord } from '@recall-ai/schemas';
import { resolveEntryPointSources } from '../entry-point-sources.js';

function file(path: string): FileRecord {
  return {
    path,
    workspace: null,
    kind: 'source',
    sizeBytes: 10,
    extension: `.${path.split('.').pop()}`,
  };
}

function entry(
  path: string,
  kind: EntryPoint['kind'] = 'bin',
  evidence: EntryPoint['evidence'] = [],
): EntryPoint {
  return { path, workspace: null, kind, evidence };
}

describe('resolveEntryPointSources', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  it('maps a bin entry pointing at dist/index.js back to src/index.ts when the source exists', async () => {
    const [resolved] = await resolveEntryPointSources(
      dir,
      [entry('apps/cli/dist/index.js', 'bin')],
      [file('apps/cli/src/index.ts'), file('apps/cli/dist/index.js')],
    );
    expect(resolved?.path).toBe('apps/cli/dist/index.js');
    expect(resolved?.sourcePath).toBe('apps/cli/src/index.ts');
  });

  it('maps a main entry pointing at dist/index.js to its source counterpart', async () => {
    const [resolved] = await resolveEntryPointSources(
      dir,
      [entry('packages/core/dist/index.js', 'main')],
      [file('packages/core/src/index.ts')],
    );
    expect(resolved?.sourcePath).toBe('packages/core/src/index.ts');
  });

  it('preserves the nested sub-path when mapping (not just the top-level index)', async () => {
    const [resolved] = await resolveEntryPointSources(
      dir,
      [entry('apps/cli/dist/commands/init.js', 'main')],
      [file('apps/cli/src/commands/init.ts')],
    );
    expect(resolved?.sourcePath).toBe('apps/cli/src/commands/init.ts');
  });

  it('uses tsconfig rootDir/outDir for custom compiler layouts', async () => {
    await writeTree(dir, {
      'packages/tool/tsconfig.json': JSON.stringify({
        compilerOptions: { rootDir: 'source', outDir: 'lib' },
      }),
    });
    const customEntry = entry('packages/tool/lib/commands/run.js', 'bin');
    customEntry.workspace = 'packages/tool';

    const [resolved] = await resolveEntryPointSources(
      dir,
      [customEntry],
      [
        {
          ...file('packages/tool/source/commands/run.ts'),
          workspace: 'packages/tool',
        },
      ],
    );

    expect(resolved?.sourcePath).toBe('packages/tool/source/commands/run.ts');
  });

  it('falls back to src/index.ts when the emitted basename does not mirror the source basename', async () => {
    const [resolved] = await resolveEntryPointSources(
      dir,
      [entry('dist/recall.js', 'bin')],
      [file('src/index.ts')],
    );
    expect(resolved?.sourcePath).toBe('src/index.ts');
  });

  it('deduplicates identical runtime paths and merges bin/main evidence', async () => {
    const entries: EntryPoint[] = [
      entry('dist/index.js', 'bin', [
        { path: 'package.json', reason: 'bin entry "recall" declared' },
      ]),
      entry('dist/index.js', 'bin', [
        { path: 'package.json', reason: 'bin entry "recall-context" declared' },
      ]),
      entry('dist/index.js', 'main', [
        { path: 'package.json', reason: 'package.json "main" field' },
      ]),
    ];

    const resolved = await resolveEntryPointSources(dir, entries, [file('src/index.ts')]);

    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.kind).toBe('bin');
    expect(resolved[0]?.sourcePath).toBe('src/index.ts');
    expect(resolved[0]?.evidence).toHaveLength(3);
  });

  it('leaves sourcePath unset when no source counterpart exists', async () => {
    const [resolved] = await resolveEntryPointSources(
      dir,
      [entry('apps/cli/dist/index.js', 'bin')],
      [file('apps/cli/dist/index.js')],
    );
    expect(resolved?.path).toBe('apps/cli/dist/index.js');
    expect(resolved?.sourcePath).toBeUndefined();
  });

  it('leaves non-bin/main entry points untouched', async () => {
    const entries: EntryPoint[] = [
      entry('src/main.ts', 'framework-convention'),
      entry('package.json', 'script'),
    ];
    const resolved = await resolveEntryPointSources(dir, entries, [file('src/main.ts')]);
    expect(resolved).toEqual(entries);
  });
});

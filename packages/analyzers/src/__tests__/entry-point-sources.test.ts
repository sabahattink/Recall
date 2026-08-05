import { describe, expect, it } from 'vitest';
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

function entry(path: string, kind: EntryPoint['kind'] = 'bin'): EntryPoint {
  return { path, workspace: null, kind, evidence: [] };
}

describe('resolveEntryPointSources', () => {
  it('maps a bin entry pointing at dist/index.js back to src/index.ts when the source exists', () => {
    const [resolved] = resolveEntryPointSources(
      [entry('apps/cli/dist/index.js', 'bin')],
      [file('apps/cli/src/index.ts'), file('apps/cli/dist/index.js')],
    );
    expect(resolved?.path).toBe('apps/cli/dist/index.js');
    expect(resolved?.sourcePath).toBe('apps/cli/src/index.ts');
  });

  it('maps a main entry pointing at dist/index.js to its source counterpart', () => {
    const [resolved] = resolveEntryPointSources(
      [entry('packages/core/dist/index.js', 'main')],
      [file('packages/core/src/index.ts')],
    );
    expect(resolved?.sourcePath).toBe('packages/core/src/index.ts');
  });

  it('preserves the nested sub-path when mapping (not just the top-level index)', () => {
    const [resolved] = resolveEntryPointSources(
      [entry('apps/cli/dist/commands/init.js', 'main')],
      [file('apps/cli/src/commands/init.ts')],
    );
    expect(resolved?.sourcePath).toBe('apps/cli/src/commands/init.ts');
  });

  it('leaves sourcePath unset when no source counterpart exists (runtime entry remains the only fallback)', () => {
    const [resolved] = resolveEntryPointSources(
      [entry('apps/cli/dist/index.js', 'bin')],
      [file('apps/cli/dist/index.js')], // no src/ counterpart in the file list
    );
    expect(resolved?.path).toBe('apps/cli/dist/index.js');
    expect(resolved?.sourcePath).toBeUndefined();
  });

  it('leaves non-generated entry points (already source, or script/framework-convention) untouched', () => {
    const entries: EntryPoint[] = [
      entry('src/main.ts', 'framework-convention'),
      entry('package.json', 'script'),
    ];
    const resolved = resolveEntryPointSources(entries, [file('src/main.ts')]);
    expect(resolved).toEqual(entries);
  });
});

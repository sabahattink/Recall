import { describe, expect, it } from 'vitest';
import type { EntryPoint } from '@recall-ai/schemas';
import { formatEntryPointKind } from '../entry-point-format.js';

describe('formatEntryPointKind', () => {
  it('renders merged bin names and main declaration without changing snapshot kind', () => {
    const entry: EntryPoint = {
      path: 'dist/index.js',
      workspace: null,
      kind: 'bin',
      evidence: [
        { path: 'package.json', reason: 'bin entry "recall" declared' },
        { path: 'package.json', reason: 'bin entry "recall-context" declared' },
        { path: 'package.json', reason: 'package.json "main" field' },
      ],
      sourcePath: 'src/index.ts',
    };

    expect(formatEntryPointKind(entry)).toBe('bin: recall, recall-context; main');
  });
});

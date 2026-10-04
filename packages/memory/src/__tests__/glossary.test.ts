import { describe, expect, it } from 'vitest';
import { analysisNoiseTree } from '@recall-ai/test-fixtures';
import type { FileRecord } from '@recall-ai/schemas';
import { generateGlossaryBody } from '../markdown/glossary.js';
import { makeSnapshot } from './test-helpers.js';

function record(path: string): FileRecord {
  return {
    path,
    workspace: null,
    kind: 'source',
    sizeBytes: 10,
    extension: '.ts',
  };
}

describe('generateGlossaryBody', () => {
  it('requires recurrence across distinct directories and ignores noisy paths', () => {
    const tree = analysisNoiseTree();
    const files = Object.keys(tree)
      .filter((path) => /\.[jt]sx?$/.test(path))
      .map(record);
    const snapshot = makeSnapshot({
      files,
      frameworks: [
        {
          name: 'nestjs',
          workspace: null,
          confidence: 'high',
          evidence: [{ path: 'package.json', reason: 'fixture' }],
        },
      ],
    });

    const body = generateGlossaryBody(snapshot);

    expect(body).toContain('**invoice**');
    expect(body).not.toContain('**fixture**');
    expect(body).not.toContain('**example**');
    expect(body).not.toContain('**generated**');
    expect(body).not.toContain('**vendor**');
    expect(body).not.toContain('**nestjs**');
  });

  it('caps glossary output at 15 terms', () => {
    const terms = [
      'alpha',
      'bravo',
      'charlie',
      'delta',
      'echo',
      'foxtrot',
      'golf',
      'hotel',
      'india',
      'juliet',
      'kilo',
      'lima',
      'mango',
      'november',
      'oscar',
      'papa',
    ];
    const files = terms.flatMap((term) => [
      record(`src/one/${term}.ts`),
      record(`src/two/${term}.ts`),
    ]);
    const body = generateGlossaryBody(makeSnapshot({ files }));
    const entries = body.split('\n').filter((line) => line.startsWith('- **'));

    expect(entries).toHaveLength(15);
  });
});

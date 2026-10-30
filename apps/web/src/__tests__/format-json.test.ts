import { describe, expect, it } from 'vitest';
import { formatJson } from '../lib/format-json';

describe('formatJson', () => {
  it('always produces JSON that parses back to the same value', () => {
    const value = {
      schemaVersion: '1.0.0',
      commands: [
        {
          name: 'test',
          command: 'vitest run',
          evidence: [{ path: 'package.json', reason: 'scripts.test declared as "vitest run"' }],
        },
      ],
      empty: { list: [], object: {} },
      flags: [true, false, null, 3],
    };
    expect(JSON.parse(formatJson(value))).toEqual(value);
  });

  it('keeps a short object of primitives on one line', () => {
    expect(formatJson({ evidence: [{ path: 'a.json', reason: 'present' }] })).toBe(
      ['{', '  "evidence": [', '    { "path": "a.json", "reason": "present" }', '  ]', '}'].join(
        '\n',
      ),
    );
  });

  it('breaks an object of primitives across lines when it exceeds the width', () => {
    const output = formatJson({ a: 'x'.repeat(40), b: 'y'.repeat(40) }, 60);
    expect(output).toBe(
      ['{', `  "a": "${'x'.repeat(40)}",`, `  "b": "${'y'.repeat(40)}"`, '}'].join('\n'),
    );
  });

  it('renders empty containers inline', () => {
    expect(formatJson({ a: [], b: {} })).toBe('{ "a": [], "b": {} }');
  });

  it('is deterministic: key order follows insertion order', () => {
    expect(formatJson({ z: 1, a: 2 })).toBe('{ "z": 1, "a": 2 }');
  });
});

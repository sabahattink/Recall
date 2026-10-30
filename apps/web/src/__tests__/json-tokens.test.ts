import { describe, expect, it } from 'vitest';
import { tokenizeJson } from '../lib/json-tokens';

describe('tokenizeJson', () => {
  it('reproduces the input exactly when tokens are concatenated', () => {
    const source = JSON.stringify(
      { a: 'x', b: [1, -2.5e3, true, false, null], c: { d: 'quote " inside' } },
      null,
      2,
    );
    const tokens = tokenizeJson(source);
    expect(tokens.map((token) => token.text).join('')).toBe(source);
  });

  it('classifies a string followed by a colon as a key, otherwise as a string value', () => {
    const tokens = tokenizeJson('{"path": "package.json"}').filter(
      (token) => token.kind !== 'whitespace',
    );
    expect(tokens).toEqual([
      { kind: 'punctuation', text: '{' },
      { kind: 'key', text: '"path"' },
      { kind: 'punctuation', text: ':' },
      { kind: 'string', text: '"package.json"' },
      { kind: 'punctuation', text: '}' },
    ]);
  });

  it('keeps escaped quotes inside a single string token', () => {
    const tokens = tokenizeJson('"scripts.test declared as \\"vitest run\\""');
    expect(tokens).toEqual([
      { kind: 'string', text: '"scripts.test declared as \\"vitest run\\""' },
    ]);
  });

  it('classifies numbers and literals', () => {
    const kinds = tokenizeJson('[1, -0.5, true, null]')
      .filter((token) => token.kind !== 'whitespace' && token.kind !== 'punctuation')
      .map((token) => token.kind);
    expect(kinds).toEqual(['number', 'number', 'literal', 'literal']);
  });

  it('throws on input that is not JSON', () => {
    expect(() => tokenizeJson('{ key: 1 }')).toThrow(/offset 2/);
  });
});

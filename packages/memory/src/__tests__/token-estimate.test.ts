import { describe, expect, it } from 'vitest';
import { estimateTokens } from '../token-estimate.js';

describe('estimateTokens', () => {
  it('returns 0 for empty input', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('is deterministic for the same input', () => {
    const text = 'The quick brown fox jumps over the lazy dog.';
    expect(estimateTokens(text)).toBe(estimateTokens(text));
  });

  it('scales roughly with input length', () => {
    const short = 'a'.repeat(40);
    const long = 'a'.repeat(400);
    expect(estimateTokens(long)).toBeGreaterThan(estimateTokens(short));
    expect(estimateTokens(long)).toBe(estimateTokens(short) * 10);
  });
});

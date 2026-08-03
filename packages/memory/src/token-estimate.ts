/**
 * Recall estimates tokens with a fixed, documented heuristic rather than a
 * model-specific tokenizer: roughly 4 characters per token, which is a
 * commonly cited approximation for English text and code. This keeps
 * estimation dependency-free and perfectly deterministic across platforms;
 * it is intentionally approximate and should not be treated as exact for any
 * particular model's tokenizer. See docs/cli-reference.md for details.
 */
export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  return Math.ceil(text.length / 4);
}
